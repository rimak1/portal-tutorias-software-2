import { describe, expect, it } from "vitest";
import type { Cita } from "@portal-tutorias/shared";
import type { CitaConRelaciones } from "../src/modules/citas/citas.puertos.js";
import { celdaCsv, historicoACsv } from "../src/modules/historico/historico.csv.js";
import { resumirHistorico } from "../src/modules/historico/historico.resumen.js";
import { HistoricoService, LIMITE_DE_HISTORICO } from "../src/modules/historico/historico.service.js";
import { MundoEnMemoria } from "./fakes.js";

const HORA = 3_600_000;
const base = new Date("2026-11-12T15:00:00Z").getTime();

function cita(id: string, estado: CitaConRelaciones["estado"], opciones: { tutor?: string; materia?: string; horas?: number; inicio?: number } = {}): CitaConRelaciones {
  const inicio = new Date(base + (opciones.inicio ?? 0) * HORA);
  return {
    id,
    estado,
    motivoRechazo: null,
    creadoEn: inicio,
    fechaFinalizacion: null,
    estudiante: { id: "est", nombre: "Ana" },
    franja: {
      id: `f-${id}`,
      fechaInicio: inicio,
      fechaFin: new Date(inicio.getTime() + (opciones.horas ?? 1) * HORA),
      materia: { nombre: opciones.materia ?? "Cálculo" },
      tutor: { id: opciones.tutor ?? "t1", nombre: opciones.tutor ?? "t1" },
    },
    propuestas: [],
  };
}

describe("resumirHistorico (F-09)", () => {
  it("un histórico vacío tiene todos los totales en cero", () => {
    expect(resumirHistorico([])).toEqual({
      total: 0,
      porEstado: { PENDIENTE: 0, APROBADA: 0, RECHAZADA: 0, CANCELADA: 0, FINALIZADA: 0 },
      horasFinalizadas: 0,
      porMateria: [],
      porTutor: [],
    });
  });

  it("cuenta por estado, materia y tutor, de mayor a menor", () => {
    const resumen = resumirHistorico([
      cita("1", "FINALIZADA", { tutor: "t1", materia: "Cálculo" }),
      cita("2", "FINALIZADA", { tutor: "t1", materia: "Física" }),
      cita("3", "RECHAZADA", { tutor: "t2", materia: "Cálculo" }),
      cita("4", "CANCELADA", { tutor: "t1", materia: "Cálculo" }),
      cita("5", "PENDIENTE", { tutor: "t2", materia: "Cálculo" }),
    ]);

    expect(resumen.total).toBe(5);
    expect(resumen.porEstado).toEqual({ PENDIENTE: 1, APROBADA: 0, RECHAZADA: 1, CANCELADA: 1, FINALIZADA: 2 });
    expect(resumen.porMateria).toEqual([
      { materia: "Cálculo", total: 4 },
      { materia: "Física", total: 1 },
    ]);
    expect(resumen.porTutor).toEqual([
      { tutor: { id: "t1", nombre: "t1" }, total: 3, finalizadas: 2 },
      { tutor: { id: "t2", nombre: "t2" }, total: 2, finalizadas: 0 },
    ]);
  });

  it("suma como horas realizadas solo las tutorías finalizadas, con un decimal", () => {
    const resumen = resumirHistorico([
      cita("1", "FINALIZADA", { horas: 1 }),
      cita("2", "FINALIZADA", { horas: 1.5 }),
      cita("3", "FINALIZADA", { horas: 0.25 }),
      cita("4", "APROBADA", { horas: 4 }),
      cita("5", "CANCELADA", { horas: 4 }),
    ]);

    expect(resumen.horasFinalizadas).toBe(2.8);
  });

  it("a igual cantidad, los tutores se ordenan por nombre", () => {
    const resumen = resumirHistorico([cita("1", "FINALIZADA", { tutor: "Zoe" }), cita("2", "FINALIZADA", { tutor: "Ana" })]);

    expect(resumen.porTutor.map((t) => t.tutor.nombre)).toEqual(["Ana", "Zoe"]);
  });
});

describe("celdaCsv: valores seguros para una hoja de cálculo", () => {
  it("deja intactos los valores simples y entrecomilla los que llevan comas, comillas o saltos de línea", () => {
    expect(celdaCsv("Cálculo I")).toBe("Cálculo I");
    expect(celdaCsv("Pérez, Ana")).toBe('"Pérez, Ana"');
    expect(celdaCsv('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(celdaCsv("línea 1\nlínea 2")).toBe('"línea 1\nlínea 2"');
  });

  it("neutraliza los valores que una hoja de cálculo interpretaría como fórmula", () => {
    for (const peligroso of ["=1+1", "+cmd", "-2+3", "@SUMA(A1)", "\t=1", "\r=1"]) {
      expect(celdaCsv(peligroso).replace(/^"/, "").startsWith("'"), peligroso).toBe(true);
    }
    expect(celdaCsv('=HYPERLINK("http://x","clic")')).toBe(`"'=HYPERLINK(""http://x"",""clic"")"`);
  });
});

describe("historicoACsv", () => {
  const citaDto = (sobreescribir: Partial<Cita> = {}): Cita => ({
    id: "11111111-1111-4111-8111-111111111111",
    estado: "FINALIZADA",
    motivoRechazo: null,
    materia: "Cálculo I",
    tutor: { id: "22222222-2222-4222-8222-222222222222", nombre: "Luis Tutor" },
    estudiante: { id: "33333333-3333-4333-8333-333333333333", nombre: "Ana Estudiante" },
    // 15:00 UTC = 10:00 en Colombia.
    franja: { id: "44444444-4444-4444-8444-444444444444", fechaInicio: "2026-11-12T15:00:00.000Z", fechaFin: "2026-11-12T16:30:00.000Z" },
    propuestaPendiente: null,
    creadoEn: "2026-11-10T12:00:00.000Z",
    fechaFinalizacion: "2026-11-12T16:35:00.000Z",
    ...sobreescribir,
  });

  it("empieza con la marca de orden de bytes y los encabezados, con saltos de línea CRLF", () => {
    const csv = historicoACsv([]);

    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿Fecha,Hora de inicio,Hora de fin,Materia,Tutor,Estudiante,Estado,Motivo del rechazo,Finalizada el\r\n");
  });

  it("escribe las horas de Colombia, no las de UTC", () => {
    const [, fila] = historicoACsv([citaDto()]).split("\r\n");

    expect(fila).toBe("2026-11-12,10:00,11:30,Cálculo I,Luis Tutor,Ana Estudiante,FINALIZADA,,2026-11-12 11:35");
  });

  it("incluye el motivo del rechazo y protege los textos escritos por los usuarios", () => {
    const [, fila] = historicoACsv([
      citaDto({ estado: "RECHAZADA", fechaFinalizacion: null, motivoRechazo: "=cmd|' /C calc'!A0", estudiante: { id: "33333333-3333-4333-8333-333333333333", nombre: "Pérez, Ana" } }),
    ]).split("\r\n");

    expect(fila).toContain('"Pérez, Ana"');
    expect(fila).toContain("'=cmd|' /C calc'!A0");
    expect(fila).not.toMatch(/,=cmd/);
  });
});

describe("HistoricoService con repositorio en memoria", () => {
  const nuevoMundo = () => {
    const mundo = new MundoEnMemoria();
    mundo.agregarTutor("t1", "Luis Tutor");
    mundo.agregarTutor("t2", "Marta Tutora");
    mundo.agregarEstudiante("e1", "Ana");
    return mundo;
  };

  it("pagina el resultado pero totaliza todo el conjunto filtrado", async () => {
    const mundo = nuevoMundo();
    for (let i = 0; i < 7; i++) {
      const franja = mundo.agregarFranja("t1", new Date(base + i * HORA), new Date(base + (i + 1) * HORA), "RESERVADA");
      mundo.agregarCita("e1", franja, "FINALIZADA");
    }
    const servicio = new HistoricoService(mundo.repos.citas);

    const pagina2 = await servicio.consultar({}, { pagina: 2, tamano: 3 });

    expect(pagina2.citas).toHaveLength(3);
    expect(pagina2.total).toBe(7);
    expect(pagina2.resumen.total).toBe(7);
    expect(pagina2.resumen.horasFinalizadas).toBe(7);
    expect(pagina2.truncado).toBe(false);
    // De la más reciente a la más antigua: la página 2 empieza en la cuarta más reciente.
    expect(pagina2.citas[0].franja.fechaInicio).toBe(new Date(base + 3 * HORA).toISOString());
  });

  it("una página más allá del final viene vacía, con los mismos totales", async () => {
    const mundo = nuevoMundo();
    mundo.agregarCita("e1", mundo.agregarFranja("t1", new Date(base), new Date(base + HORA), "RESERVADA"), "FINALIZADA");

    const resultado = await new HistoricoService(mundo.repos.citas).consultar({}, { pagina: 5, tamano: 20 });

    expect(resultado.citas).toEqual([]);
    expect(resultado.total).toBe(1);
  });

  it("aplica los filtros de tutor, estado y rango de fechas", async () => {
    const mundo = nuevoMundo();
    const f1 = mundo.agregarFranja("t1", new Date(base), new Date(base + HORA), "RESERVADA");
    const f2 = mundo.agregarFranja("t2", new Date(base + 24 * HORA), new Date(base + 25 * HORA), "RESERVADA");
    const f3 = mundo.agregarFranja("t1", new Date(base + 48 * HORA), new Date(base + 49 * HORA), "RESERVADA");
    mundo.agregarCita("e1", f1, "FINALIZADA");
    mundo.agregarCita("e1", f2, "CANCELADA");
    mundo.agregarCita("e1", f3, "FINALIZADA");
    const servicio = new HistoricoService(mundo.repos.citas);
    const pagina = { pagina: 1, tamano: 20 };

    expect((await servicio.consultar({ tutorId: "t1" }, pagina)).total).toBe(2);
    expect((await servicio.consultar({ estado: "CANCELADA" }, pagina)).total).toBe(1);
    expect((await servicio.consultar({ desde: new Date(base + 24 * HORA).toISOString() }, pagina)).total).toBe(2);
    expect((await servicio.consultar({ hasta: new Date(base + 24 * HORA).toISOString() }, pagina)).total).toBe(1);
    expect((await servicio.consultar({ tutorId: "t1", estado: "CANCELADA" }, pagina)).total).toBe(0);
  });

  it("avisa cuando el conjunto alcanza el tope que se calcula de una vez", async () => {
    const mundo = nuevoMundo();
    const servicio = new HistoricoService({
      ...mundo.repos.citas,
      buscarEnHistorico: async (_filtro, limite) => {
        expect(limite).toBe(LIMITE_DE_HISTORICO);
        return Array.from({ length: LIMITE_DE_HISTORICO }, (_, i) => cita(`c${i}`, "FINALIZADA"));
      },
    });

    const resultado = await servicio.consultar({}, { pagina: 1, tamano: 20 });

    expect(resultado.truncado).toBe(true);
    expect(resultado.total).toBe(LIMITE_DE_HISTORICO);
  });

  it("el detalle trae la cita con su bitácora; una cita inexistente es un 404", async () => {
    const mundo = nuevoMundo();
    const idCita = mundo.agregarCita("e1", mundo.agregarFranja("t1", new Date(base), new Date(base + HORA), "RESERVADA"), "APROBADA");
    mundo.datos.historial.push(
      { citaId: idCita, estadoAnterior: null, estadoNuevo: "PENDIENTE", actorId: "e1", detalle: "Solicitud de tutoría creada" },
      { citaId: idCita, estadoAnterior: "PENDIENTE", estadoNuevo: "APROBADA", actorId: "t1", detalle: "Solicitud aprobada" },
    );
    const servicio = new HistoricoService(mundo.repos.citas);

    const detalle = await servicio.detalle(idCita);

    expect(detalle.cita.id).toBe(idCita);
    expect(detalle.eventos.map((e) => [e.estadoAnterior, e.estadoNuevo, e.actor.nombre])).toEqual([
      [null, "PENDIENTE", "Ana"],
      ["PENDIENTE", "APROBADA", "Luis Tutor"],
    ]);
    await expect(servicio.detalle("no-existe")).rejects.toMatchObject({ statusCode: 404 });
  });
});
