import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { EstadoCita } from "@prisma/client";
import { buildApp } from "../src/app.js";
import { crearFranja, crearUsuario, env, iniciarSesion, limpiar, prisma } from "./helpers.js";

/**
 * F-09 (SWR-17). Pruebas de integración contra PostgreSQL real. Otros archivos
 * crean citas a la vez en la misma base, así que cada consulta se acota a las
 * materias de este archivo (prefijo `his`).
 */

const P = "his";
const HORA = 3_600_000;
// Instante fijo: los rangos de fechas de las pruebas no dependen de la hora a la que corren.
const BASE = new Date("2027-03-01T15:00:00Z").getTime();
const en = (horas: number) => new Date(BASE + horas * HORA);

type Cookies = Record<string, string>;
interface CitaJson {
  id: string;
  estado: EstadoCita;
  materia: string;
  tutor: { id: string; nombre: string };
  estudiante: { nombre: string };
  franja: { fechaInicio: string };
}
interface HistoricoJson {
  citas: CitaJson[];
  pagina: number;
  tamano: number;
  total: number;
  truncado: boolean;
  resumen: {
    total: number;
    porEstado: Record<EstadoCita, number>;
    horasFinalizadas: number;
    porMateria: Array<{ materia: string; total: number }>;
    porTutor: Array<{ tutor: { id: string; nombre: string }; total: number; finalizadas: number }>;
  };
}

let app: FastifyInstance;
let tutorA: { id: string };
let tutorB: { id: string };
let estudiante: { id: string };
let calculo: { id: string };
let fisica: { id: string };
let cookiesCoordinador: Cookies;
let cookiesAdmin: Cookies;
let cookiesTutor: Cookies;
let cookiesEstudiante: Cookies;
let citaConBitacora: string;

async function sembrarCita(tutorId: string, materiaId: string, inicio: number, duracion: number, estado: EstadoCita, extra: { motivoRechazo?: string; nombreEstudianteId?: string } = {}) {
  const franja = await crearFranja(tutorId, materiaId, en(inicio), en(inicio + duracion), "RESERVADA");
  return prisma.cita.create({
    data: {
      estudianteId: extra.nombreEstudianteId ?? estudiante.id,
      franjaId: franja.id,
      estado,
      motivoRechazo: extra.motivoRechazo,
      fechaFinalizacion: estado === "FINALIZADA" ? en(inicio + duracion) : undefined,
    },
  });
}

beforeAll(async () => {
  app = await buildApp(env);
  await app.ready();
  await limpiar(P);

  tutorA = await crearUsuario(P, "Tutor A", "TUTOR");
  tutorB = await crearUsuario(P, "Tutor B", "TUTOR");
  estudiante = await crearUsuario(P, "Estudiante", "ESTUDIANTE");
  const coordinador = await crearUsuario(P, "Coordinador", "COORDINADOR");
  const administrador = await crearUsuario(P, "Administrador", "ADMINISTRADOR");
  const tutorSesion = tutorA as { id: string; correo: string };
  calculo = await prisma.materia.create({ data: { nombre: `${P} Cálculo` } });
  fisica = await prisma.materia.create({ data: { nombre: `${P} Física` } });

  // Tutor A: 2 finalizadas de Cálculo (1 h y 2 h), 1 rechazada de Cálculo y 1 aprobada de Física.
  await sembrarCita(tutorA.id, calculo.id, 0, 1, "FINALIZADA");
  await sembrarCita(tutorA.id, calculo.id, 24, 2, "FINALIZADA");
  await sembrarCita(tutorA.id, calculo.id, 48, 1, "RECHAZADA", { motivoRechazo: "Ese día no atiendo" });
  await sembrarCita(tutorA.id, fisica.id, 72, 1, "APROBADA");
  // Tutor B: 1 cancelada de Física y 1 pendiente de Cálculo, ambas más adelante en el tiempo.
  await sembrarCita(tutorB.id, fisica.id, 96, 1, "CANCELADA");
  const conBitacora = await sembrarCita(tutorB.id, calculo.id, 120, 1, "PENDIENTE");
  citaConBitacora = conBitacora.id;
  await prisma.historialEstadoCita.createMany({
    data: [
      { citaId: citaConBitacora, estadoAnterior: null, estadoNuevo: "PENDIENTE", actorId: estudiante.id, detalle: "Solicitud de tutoría creada", creadoEn: en(-10) },
      { citaId: citaConBitacora, estadoAnterior: "PENDIENTE", estadoNuevo: "PENDIENTE", actorId: tutorB.id, detalle: "Reprogramación propuesta por el tutor", creadoEn: en(-9) },
    ],
  });

  cookiesCoordinador = await iniciarSesion(app, coordinador.correo);
  cookiesAdmin = await iniciarSesion(app, administrador.correo);
  cookiesTutor = await iniciarSesion(app, tutorSesion.correo);
  cookiesEstudiante = await iniciarSesion(app, (await prisma.usuario.findUniqueOrThrow({ where: { id: estudiante.id } })).correo);
});

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
  await app.close();
});

const consulta = (filtros: Record<string, string> = {}) =>
  new URLSearchParams({ ...filtros }).toString();

/** Consulta limitada a las dos materias de este archivo, salvo que se pida otra cosa. */
async function historico(cookies: Cookies, filtros: Record<string, string> = {}, materia: string | null = null) {
  const respuesta = await app.inject({ method: "GET", url: `/api/historico?${consulta({ ...(materia ? { materiaId: materia } : {}), ...filtros })}`, cookies });
  return { respuesta, cuerpo: respuesta.json() as HistoricoJson };
}

/** Las citas de las dos materias de este archivo: se pide Cálculo y Física por separado y se juntan. */
async function todasLasDeEsteArchivo(cookies = cookiesCoordinador) {
  const [a, b] = await Promise.all([historico(cookies, {}, calculo.id), historico(cookies, {}, fisica.id)]);
  return { calculo: a.cuerpo, fisica: b.cuerpo };
}

describe("F-09: quién puede consultar el histórico (RN-001)", () => {
  it("el coordinador y el administrador consultan, exportan y ven el detalle", async () => {
    for (const cookies of [cookiesCoordinador, cookiesAdmin]) {
      expect((await app.inject({ method: "GET", url: `/api/historico?materiaId=${calculo.id}`, cookies })).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: `/api/historico/exportar?materiaId=${calculo.id}`, cookies })).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: `/api/historico/${citaConBitacora}`, cookies })).statusCode).toBe(200);
    }
  });

  it("estudiantes y tutores no tienen acceso (403) y sin sesión es 401", async () => {
    for (const url of ["/api/historico", "/api/historico/exportar", `/api/historico/${citaConBitacora}`]) {
      for (const cookies of [cookiesEstudiante, cookiesTutor]) {
        expect((await app.inject({ method: "GET", url, cookies })).statusCode, url).toBe(403);
      }
      expect((await app.inject({ method: "GET", url })).statusCode, url).toBe(401);
    }
  });
});

describe("GET /api/historico", () => {
  it("lista las tutorías de la más reciente a la más antigua, con sus participantes", async () => {
    const { calculo: lista } = await todasLasDeEsteArchivo();

    expect(lista.citas.map((c) => c.estado)).toEqual(["PENDIENTE", "RECHAZADA", "FINALIZADA", "FINALIZADA"]);
    const fechas = lista.citas.map((c) => Date.parse(c.franja.fechaInicio));
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    expect(lista.citas[0]).toMatchObject({ materia: `${P} Cálculo`, tutor: { id: tutorB.id, nombre: "Tutor B" }, estudiante: { nombre: "Estudiante" } });
  });

  it("calcula el resumen: totales por estado, por materia y por tutor, y las horas realizadas", async () => {
    const { cuerpo } = await historico(cookiesCoordinador, { tutorId: tutorA.id });

    expect(cuerpo.total).toBe(4);
    expect(cuerpo.resumen.total).toBe(4);
    expect(cuerpo.resumen.porEstado).toEqual({ PENDIENTE: 0, APROBADA: 1, RECHAZADA: 1, CANCELADA: 0, FINALIZADA: 2 });
    expect(cuerpo.resumen.horasFinalizadas).toBe(3);
    expect(cuerpo.resumen.porMateria).toEqual([
      { materia: `${P} Cálculo`, total: 3 },
      { materia: `${P} Física`, total: 1 },
    ]);
    expect(cuerpo.resumen.porTutor).toEqual([{ tutor: { id: tutorA.id, nombre: "Tutor A" }, total: 4, finalizadas: 2 }]);
  });

  it("filtra por materia, estado y tutor, y los filtros se combinan", async () => {
    expect((await historico(cookiesCoordinador, {}, fisica.id)).cuerpo.total).toBe(2);
    expect((await historico(cookiesCoordinador, { estado: "FINALIZADA" }, calculo.id)).cuerpo.total).toBe(2);
    expect((await historico(cookiesCoordinador, { tutorId: tutorB.id, estado: "CANCELADA" })).cuerpo.citas.map((c) => c.estado)).toEqual(["CANCELADA"]);
    expect((await historico(cookiesCoordinador, { tutorId: tutorA.id, estado: "CANCELADA" })).cuerpo.total).toBe(0);
  });

  it("filtra por rango de fechas: desde incluye el instante inicial y hasta lo excluye", async () => {
    const dia = (horas: number) => en(horas).toISOString();

    const desde = await historico(cookiesCoordinador, { tutorId: tutorA.id, desde: dia(24) });
    const hasta = await historico(cookiesCoordinador, { tutorId: tutorA.id, hasta: dia(24) });
    const entre = await historico(cookiesCoordinador, { tutorId: tutorA.id, desde: dia(24), hasta: dia(72) });

    expect(desde.cuerpo.total).toBe(3);
    expect(hasta.cuerpo.total).toBe(1);
    expect(entre.cuerpo.citas.map((c) => c.estado)).toEqual(["RECHAZADA", "FINALIZADA"]);
  });

  it("pagina el resultado sin alterar los totales", async () => {
    const primera = await historico(cookiesCoordinador, { tutorId: tutorA.id, tamano: "3", pagina: "1" });
    const segunda = await historico(cookiesCoordinador, { tutorId: tutorA.id, tamano: "3", pagina: "2" });
    const tercera = await historico(cookiesCoordinador, { tutorId: tutorA.id, tamano: "3", pagina: "3" });

    expect([primera.cuerpo.citas.length, segunda.cuerpo.citas.length, tercera.cuerpo.citas.length]).toEqual([3, 1, 0]);
    expect(primera.cuerpo).toMatchObject({ pagina: 1, tamano: 3, total: 4, truncado: false });
    expect(segunda.cuerpo.resumen.total).toBe(4);
    const ids = [...primera.cuerpo.citas, ...segunda.cuerpo.citas].map((c) => c.id);
    expect(new Set(ids).size).toBe(4);
  });

  it("rechaza filtros inválidos con un mensaje claro", async () => {
    const casos: Array<[Record<string, string>, string]> = [
      [{ desde: "ayer" }, "La fecha inicial no es válida."],
      [{ hasta: "2027-13-45" }, "La fecha final no es válida."],
      [{ desde: "2027-03-02T00:00:00Z", hasta: "2027-03-01T00:00:00Z" }, "La fecha inicial debe ser anterior a la final."],
      [{ tutorId: "no-es-uuid" }, "El tutor seleccionado no es válido."],
      [{ materiaId: "123" }, "La materia seleccionada no es válida."],
      [{ estado: "EN_VUELO" }, "El estado seleccionado no es válido."],
      [{ pagina: "0" }, "La página no es válida."],
      [{ tamano: "1000" }, "El tamaño de página no puede superar 100."],
    ];

    for (const [filtros, mensaje] of casos) {
      const { respuesta } = await historico(cookiesCoordinador, filtros);
      expect(respuesta.statusCode, JSON.stringify(filtros)).toBe(400);
      expect(respuesta.json().message, JSON.stringify(filtros)).toBe(mensaje);
    }
  });

  it("devuelve un histórico vacío, con totales en cero, cuando nada cumple el filtro", async () => {
    const { cuerpo } = await historico(cookiesCoordinador, { tutorId: tutorA.id, estado: "PENDIENTE" });

    expect(cuerpo.citas).toEqual([]);
    expect(cuerpo.resumen).toMatchObject({ total: 0, horasFinalizadas: 0, porMateria: [], porTutor: [] });
  });
});

describe("GET /api/historico/:id", () => {
  it("trae la cita con la bitácora de sus cambios de estado, en orden", async () => {
    const respuesta = await app.inject({ method: "GET", url: `/api/historico/${citaConBitacora}`, cookies: cookiesCoordinador });

    expect(respuesta.statusCode).toBe(200);
    const { cita, eventos } = respuesta.json();
    expect(cita).toMatchObject({ id: citaConBitacora, estado: "PENDIENTE", materia: `${P} Cálculo` });
    expect(eventos).toHaveLength(2);
    expect(eventos[0]).toMatchObject({ estadoAnterior: null, estadoNuevo: "PENDIENTE", detalle: "Solicitud de tutoría creada", actor: { id: estudiante.id, nombre: "Estudiante" } });
    expect(eventos[1]).toMatchObject({ detalle: "Reprogramación propuesta por el tutor", actor: { id: tutorB.id, nombre: "Tutor B" } });
  });

  it("una cita inexistente o un identificador mal formado es un 404", async () => {
    expect((await app.inject({ method: "GET", url: "/api/historico/00000000-0000-4000-8000-000000000000", cookies: cookiesCoordinador })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/historico/no-es-uuid", cookies: cookiesCoordinador })).statusCode).toBe(404);
  });
});

describe("GET /api/historico/exportar", () => {
  it("descarga un CSV con los encabezados, una fila por tutoría y la hora de Colombia", async () => {
    const respuesta = await app.inject({ method: "GET", url: `/api/historico/exportar?${consulta({ tutorId: tutorA.id, estado: "RECHAZADA" })}`, cookies: cookiesCoordinador });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(respuesta.headers["content-disposition"]).toBe('attachment; filename="historico-tutorias.csv"');
    const [encabezado, fila, vacia] = respuesta.body.split("\r\n");
    expect(encabezado).toBe("﻿Fecha,Hora de inicio,Hora de fin,Materia,Tutor,Estudiante,Estado,Motivo del rechazo,Finalizada el");
    // BASE + 48 h = 2027-03-03 15:00 UTC = 10:00 en Colombia.
    expect(fila).toBe(`2027-03-03,10:00,11:00,${P} Cálculo,Tutor A,Estudiante,RECHAZADA,Ese día no atiendo,`);
    expect(vacia).toBe("");
  });

  it("exporta todo el conjunto filtrado, no una sola página", async () => {
    const respuesta = await app.inject({ method: "GET", url: `/api/historico/exportar?${consulta({ tutorId: tutorA.id })}`, cookies: cookiesAdmin });

    expect(respuesta.body.split("\r\n").filter(Boolean)).toHaveLength(1 + 4);
  });

  it("neutraliza las fórmulas que un usuario haya escrito en el motivo del rechazo", async () => {
    const maliciosa = await sembrarCita(tutorB.id, fisica.id, 200, 1, "RECHAZADA", { motivoRechazo: "=HYPERLINK(\"http://x\",\"clic\")" });

    const respuesta = await app.inject({ method: "GET", url: `/api/historico/exportar?${consulta({ tutorId: tutorB.id, estado: "RECHAZADA" })}`, cookies: cookiesCoordinador });

    expect(respuesta.body).toContain(`"'=HYPERLINK(""http://x"",""clic"")"`);
    expect(respuesta.body).not.toMatch(/,=HYPERLINK/);
    await prisma.cita.delete({ where: { id: maliciosa.id } });
  });

  it("valida los filtros igual que la consulta", async () => {
    const respuesta = await app.inject({ method: "GET", url: "/api/historico/exportar?estado=NADA", cookies: cookiesCoordinador });

    expect(respuesta.statusCode).toBe(400);
  });
});
