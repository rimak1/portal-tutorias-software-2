import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { crearFranja, crearUsuario, env, iniciarSesion, limpiar, prisma } from "./helpers.js";

const P = "fra";
// Instante base fijo: con la hora actual cada llamada difiere unos milisegundos y las franjas "contiguas" se solaparian.
const T0 = Date.now();
const instante = (horas: number) => new Date(T0 + horas * 60 * 60 * 1000);
let app: FastifyInstance;
let tutor: { id: string };
let otroTutor: { id: string };
let materia: { id: string };
let materiaAjena: { id: string };
let cookiesTutor: Record<string, string>;
let cookiesOtroTutor: Record<string, string>;
let cookiesEstudiante: Record<string, string>;

beforeAll(async () => {
  app = await buildApp(env);
  await app.ready();
  await limpiar(P);

  tutor = await crearUsuario(P, "Tutor", "TUTOR");
  otroTutor = await crearUsuario(P, "Otro Tutor", "TUTOR");
  const estudiante = await crearUsuario(P, "Estudiante", "ESTUDIANTE");

  materia = await prisma.materia.create({ data: { nombre: `${P} Materia Propia` } });
  materiaAjena = await prisma.materia.create({ data: { nombre: `${P} Materia Ajena` } });
  await prisma.tutorMateria.create({ data: { tutorId: tutor.id, materiaId: materia.id } });
  await prisma.tutorMateria.create({ data: { tutorId: otroTutor.id, materiaId: materia.id } });

  cookiesTutor = await iniciarSesion(app, (await prisma.usuario.findUniqueOrThrow({ where: { id: tutor.id } })).correo);
  cookiesOtroTutor = await iniciarSesion(app, (await prisma.usuario.findUniqueOrThrow({ where: { id: otroTutor.id } })).correo);
  cookiesEstudiante = await iniciarSesion(app, estudiante.correo);
});

beforeEach(async () => {
  await prisma.disponibilidad.deleteMany({ where: { tutorId: { in: [tutor.id, otroTutor.id] } } });
});

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
  await app.close();
});

const crear = (cookies: Record<string, string>, inicioH: number, finH: number, materiaId = materia.id) =>
  app.inject({
    method: "POST",
    url: "/api/disponibilidad",
    cookies,
    payload: { materiaId, fechaInicio: instante(inicioH).toISOString(), fechaFin: instante(finH).toISOString() },
  });

describe("SWR-03: crear una franja con fecha, hora de inicio y hora de fin", () => {
  it("registra la franja y queda almacenada con los datos ingresados", async () => {
    const inicio = instante(30);
    const fin = instante(31);
    const response = await app.inject({
      method: "POST",
      url: "/api/disponibilidad",
      cookies: cookiesTutor,
      payload: { materiaId: materia.id, fechaInicio: inicio.toISOString(), fechaFin: fin.toISOString() },
    });

    expect(response.statusCode).toBe(201);
    const guardada = await prisma.disponibilidad.findUniqueOrThrow({ where: { id: response.json().franja.id } });
    expect(guardada.tutorId).toBe(tutor.id);
    expect(guardada.materiaId).toBe(materia.id);
    expect(guardada.fechaInicio.toISOString()).toBe(inicio.toISOString());
    expect(guardada.fechaFin.toISOString()).toBe(fin.toISOString());
    expect(guardada.estado).toBe("LIBRE");
  });

  it("aparece en la agenda propia del tutor", async () => {
    await crear(cookiesTutor, 30, 31);
    const response = await app.inject({ method: "GET", url: "/api/disponibilidad/mias", cookies: cookiesTutor });
    expect(response.statusCode).toBe(200);
    expect(response.json().franjas).toHaveLength(1);
    expect(response.json().franjas[0].estado).toBe("LIBRE");
  });

  it("rechaza una hora de fin anterior o igual a la de inicio", async () => {
    expect((await crear(cookiesTutor, 31, 30)).statusCode).toBe(400);
    expect((await crear(cookiesTutor, 30, 30)).statusCode).toBe(400);
  });

  it("rechaza una franja que comienza en el pasado", async () => {
    const response = await crear(cookiesTutor, -2, 1);
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("futuro");
  });

  it("rechaza fechas con formato invalido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/disponibilidad",
      cookies: cookiesTutor,
      payload: { materiaId: materia.id, fechaInicio: "mañana", fechaFin: "pasado" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("exige una materia del perfil del tutor", async () => {
    const response = await crear(cookiesTutor, 30, 31, materiaAjena.id);
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("Mis materias");
  });

  it("solo un tutor puede crear franjas (RN-001)", async () => {
    expect((await crear(cookiesEstudiante, 30, 31)).statusCode).toBe(403);
    const sinSesion = await app.inject({ method: "POST", url: "/api/disponibilidad", payload: {} });
    expect(sinSesion.statusCode).toBe(401);
  });
});

describe("SWR-04: impedir franjas traslapadas para un mismo tutor", () => {
  it("rechaza una franja que se cruza con otra del mismo tutor", async () => {
    expect((await crear(cookiesTutor, 30, 32)).statusCode).toBe(201);

    const parcial = await crear(cookiesTutor, 31, 33);
    expect(parcial.statusCode).toBe(409);
    expect(parcial.json().message).toContain("traslapa");

    const contenida = await crear(cookiesTutor, 30.5, 31.5);
    expect(contenida.statusCode).toBe(409);

    const envolvente = await crear(cookiesTutor, 29, 34);
    expect(envolvente.statusCode).toBe(409);

    expect(await prisma.disponibilidad.count({ where: { tutorId: tutor.id } })).toBe(1);
  });

  it("acepta franjas contiguas (el fin de una es el inicio de la otra)", async () => {
    expect((await crear(cookiesTutor, 30, 31)).statusCode).toBe(201);
    expect((await crear(cookiesTutor, 31, 32)).statusCode).toBe(201);
    expect((await crear(cookiesTutor, 29, 30)).statusCode).toBe(201);
  });

  it("dos tutores distintos pueden tener el mismo horario", async () => {
    expect((await crear(cookiesTutor, 30, 31)).statusCode).toBe(201);
    expect((await crear(cookiesOtroTutor, 30, 31)).statusCode).toBe(201);
  });

  it("una franja eliminada ya no bloquea ese horario", async () => {
    const creada = await crear(cookiesTutor, 30, 31);
    await app.inject({ method: "DELETE", url: `/api/disponibilidad/${creada.json().franja.id}`, cookies: cookiesTutor });
    expect((await crear(cookiesTutor, 30, 31)).statusCode).toBe(201);
  });

  it("dos solicitudes simultaneas con horario cruzado: solo una se registra", async () => {
    const respuestas = await Promise.all([crear(cookiesTutor, 40, 42), crear(cookiesTutor, 41, 43), crear(cookiesTutor, 40.5, 41.5)]);

    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409, 409]);
    expect(await prisma.disponibilidad.count({ where: { tutorId: tutor.id } })).toBe(1);
  });

  it("la base de datos lo impone aunque se omita la API (defensa en profundidad)", async () => {
    await crearFranja(tutor.id, materia.id, instante(50), instante(52));

    await expect(crearFranja(tutor.id, materia.id, instante(51), instante(53))).rejects.toThrow();
    await expect(crearFranja(tutor.id, materia.id, instante(52), instante(53))).resolves.toBeDefined();
    await expect(crearFranja(tutor.id, materia.id, instante(60), instante(59))).rejects.toThrow();
  });
});

describe("modificar una franja (RN-003)", () => {
  it("actualiza una franja libre", async () => {
    const creada = (await crear(cookiesTutor, 30, 31)).json().franja;
    const nuevoFin = instante(32).toISOString();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/disponibilidad/${creada.id}`,
      cookies: cookiesTutor,
      payload: { fechaFin: nuevoFin },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().franja.fechaFin).toBe(nuevoFin);
  });

  it("no permite que la modificacion cause un traslape", async () => {
    await crear(cookiesTutor, 30, 31);
    const segunda = (await crear(cookiesTutor, 32, 33)).json().franja;

    const response = await app.inject({
      method: "PATCH",
      url: `/api/disponibilidad/${segunda.id}`,
      cookies: cookiesTutor,
      payload: { fechaInicio: instante(30.5).toISOString() },
    });

    expect(response.statusCode).toBe(409);
  });

  it("no permite modificar una franja reservada", async () => {
    const franja = await crearFranja(tutor.id, materia.id, instante(30), instante(31), "RESERVADA");

    const response = await app.inject({
      method: "PATCH",
      url: `/api/disponibilidad/${franja.id}`,
      cookies: cookiesTutor,
      payload: { fechaFin: instante(32).toISOString() },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("reservada");
  });

  it("un tutor no puede modificar la franja de otro tutor", async () => {
    const ajena = await crearFranja(otroTutor.id, materia.id, instante(30), instante(31));
    const response = await app.inject({
      method: "PATCH",
      url: `/api/disponibilidad/${ajena.id}`,
      cookies: cookiesTutor,
      payload: { fechaFin: instante(32).toISOString() },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("SWR-05: eliminar una franja que aun no ha sido reservada", () => {
  it("elimina una franja libre y deja de aparecer en la disponibilidad publica", async () => {
    const creada = (await crear(cookiesTutor, 30, 31)).json().franja;

    const antes = await app.inject({ method: "GET", url: `/api/disponibilidad?tutorId=${tutor.id}`, cookies: cookiesEstudiante });
    expect(antes.json().disponibilidades.map((d: { id: string }) => d.id)).toContain(creada.id);

    const response = await app.inject({ method: "DELETE", url: `/api/disponibilidad/${creada.id}`, cookies: cookiesTutor });
    expect(response.statusCode).toBe(204);

    const despues = await app.inject({ method: "GET", url: `/api/disponibilidad?tutorId=${tutor.id}`, cookies: cookiesEstudiante });
    expect(despues.json().disponibilidades.map((d: { id: string }) => d.id)).not.toContain(creada.id);

    const propia = await app.inject({ method: "GET", url: "/api/disponibilidad/mias", cookies: cookiesTutor });
    expect(propia.json().franjas).toEqual([]);
  });

  it("no elimina una franja reservada: primero debe gestionarse la cita", async () => {
    const franja = await crearFranja(tutor.id, materia.id, instante(30), instante(31), "RESERVADA");

    const response = await app.inject({ method: "DELETE", url: `/api/disponibilidad/${franja.id}`, cookies: cookiesTutor });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("reservada");
    expect((await prisma.disponibilidad.findUniqueOrThrow({ where: { id: franja.id } })).eliminadaEn).toBeNull();
  });

  it("un tutor no puede eliminar la franja de otro tutor", async () => {
    const ajena = await crearFranja(otroTutor.id, materia.id, instante(30), instante(31));
    const response = await app.inject({ method: "DELETE", url: `/api/disponibilidad/${ajena.id}`, cookies: cookiesTutor });
    expect(response.statusCode).toBe(404);
  });

  it("una franja inexistente o con identificador invalido responde 404", async () => {
    const inexistente = await app.inject({
      method: "DELETE",
      url: "/api/disponibilidad/00000000-0000-4000-8000-000000000000",
      cookies: cookiesTutor,
    });
    expect(inexistente.statusCode).toBe(404);

    const invalido = await app.inject({ method: "DELETE", url: "/api/disponibilidad/abc", cookies: cookiesTutor });
    expect(invalido.statusCode).toBe(404);
  });

  it("solo un tutor puede eliminar franjas (RN-001)", async () => {
    const propia = await crearFranja(tutor.id, materia.id, instante(30), instante(31));
    const response = await app.inject({ method: "DELETE", url: `/api/disponibilidad/${propia.id}`, cookies: cookiesEstudiante });
    expect(response.statusCode).toBe(403);
  });
});
