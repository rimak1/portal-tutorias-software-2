import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { crearFranja, crearUsuario, env, iniciarSesion, limpiar, prisma } from "./helpers.js";

const P = "cit";
// Instante base fijo para que las horas relativas sean coherentes dentro de cada prueba.
const T0 = Date.now();
const instante = (horas: number) => new Date(T0 + horas * 60 * 60 * 1000);

type Cookies = Record<string, string>;

let app: FastifyInstance;
let tutor: { id: string };
let otroTutor: { id: string };
let estudiante: { id: string };
let otroEstudiante: { id: string };
let materia: { id: string };
let cookiesTutor: Cookies;
let cookiesOtroTutor: Cookies;
let cookiesEstudiante: Cookies;
let cookiesOtroEstudiante: Cookies;
let cookiesCoordinador: Cookies;
let cookiesRivales: Cookies[];

beforeAll(async () => {
  app = await buildApp(env);
  await app.ready();
  await limpiar(P);

  const usuarioTutor = await crearUsuario(P, "Tutor", "TUTOR");
  const usuarioOtroTutor = await crearUsuario(P, "Otro Tutor", "TUTOR");
  const usuarioEstudiante = await crearUsuario(P, "Estudiante", "ESTUDIANTE");
  const usuarioOtroEstudiante = await crearUsuario(P, "Otro Estudiante", "ESTUDIANTE");
  const coordinador = await crearUsuario(P, "Coordinador", "COORDINADOR");
  const rivales = await Promise.all([1, 2, 3, 4, 5].map((n) => crearUsuario(P, `Rival ${n}`, "ESTUDIANTE")));

  tutor = usuarioTutor;
  otroTutor = usuarioOtroTutor;
  estudiante = usuarioEstudiante;
  otroEstudiante = usuarioOtroEstudiante;
  materia = await prisma.materia.create({ data: { nombre: `${P} Materia` } });
  await prisma.tutorMateria.createMany({
    data: [
      { tutorId: tutor.id, materiaId: materia.id },
      { tutorId: otroTutor.id, materiaId: materia.id },
    ],
  });

  cookiesTutor = await iniciarSesion(app, usuarioTutor.correo);
  cookiesOtroTutor = await iniciarSesion(app, usuarioOtroTutor.correo);
  cookiesEstudiante = await iniciarSesion(app, usuarioEstudiante.correo);
  cookiesOtroEstudiante = await iniciarSesion(app, usuarioOtroEstudiante.correo);
  cookiesCoordinador = await iniciarSesion(app, coordinador.correo);
  cookiesRivales = await Promise.all(rivales.map((r) => iniciarSesion(app, r.correo)));
});

beforeEach(async () => {
  const tutores = { in: [tutor.id, otroTutor.id] };
  const citas = { franja: { tutorId: tutores } };
  await prisma.historialEstadoCita.deleteMany({ where: { cita: citas } });
  await prisma.propuestaReprogramacion.deleteMany({ where: { cita: citas } });
  await prisma.cita.deleteMany({ where: citas });
  await prisma.disponibilidad.deleteMany({ where: { tutorId: tutores } });
});

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
  await app.close();
});

const nuevaFranja = (horasDesdeAhora: number, duracion = 1, tutorId = tutor.id) =>
  crearFranja(tutorId, materia.id, instante(horasDesdeAhora), instante(horasDesdeAhora + duracion));

const post = (cookies: Cookies, url: string, payload: object = {}) => app.inject({ method: "POST", url, cookies, payload });
const reservar = (cookies: Cookies, franjaId: string) => post(cookies, "/api/citas", { disponibilidadId: franjaId });
const aprobar = (citaId: string, cookies = cookiesTutor) => post(cookies, `/api/citas/${citaId}/aprobar`);
const cancelar = (citaId: string, cookies = cookiesEstudiante) => post(cookies, `/api/citas/${citaId}/cancelar`);

const estadoFranja = async (id: string) => (await prisma.disponibilidad.findUniqueOrThrow({ where: { id } })).estado;
const estadoCita = async (id: string) => (await prisma.cita.findUniqueOrThrow({ where: { id } })).estado;

/** Reserva una franja nueva con el estudiante principal y devuelve ambos ids. */
async function citaPendiente(horasDesdeAhora = 30) {
  const franja = await nuevaFranja(horasDesdeAhora);
  const respuesta = await reservar(cookiesEstudiante, franja.id);
  return { franja, citaId: respuesta.json().cita.id as string };
}

const disponiblesDe = async (tutorId: string) => {
  const response = await app.inject({ method: "GET", url: `/api/disponibilidad?tutorId=${tutorId}`, cookies: cookiesEstudiante });
  return response.json().disponibilidades.map((d: { id: string }) => d.id) as string[];
};

describe("SWR-08: la cita se registra con estado Pendiente al reservar", () => {
  it("crea la cita Pendiente, reserva la franja y deja constancia en el historial", async () => {
    const franja = await nuevaFranja(30);

    const response = await reservar(cookiesEstudiante, franja.id);

    expect(response.statusCode).toBe(201);
    const { cita } = response.json();
    expect(cita.estado).toBe("PENDIENTE");
    expect(cita.franja.id).toBe(franja.id);
    expect(cita.estudiante.id).toBe(estudiante.id);
    expect(cita.tutor.id).toBe(tutor.id);

    expect(await estadoCita(cita.id)).toBe("PENDIENTE");
    expect(await estadoFranja(franja.id)).toBe("RESERVADA");

    const historial = await prisma.historialEstadoCita.findMany({ where: { citaId: cita.id } });
    expect(historial).toHaveLength(1);
    expect(historial[0]).toMatchObject({ estadoAnterior: null, estadoNuevo: "PENDIENTE", actorId: estudiante.id });
  });

  it("la franja reservada deja de estar disponible para otros estudiantes (RN-004)", async () => {
    const franja = await nuevaFranja(30);
    expect(await disponiblesDe(tutor.id)).toContain(franja.id);

    await reservar(cookiesEstudiante, franja.id);

    expect(await disponiblesDe(tutor.id)).not.toContain(franja.id);
  });

  it("rechaza una franja inexistente, eliminada, ya iniciada o con identificador invalido", async () => {
    expect((await reservar(cookiesEstudiante, "00000000-0000-4000-8000-000000000000")).statusCode).toBe(404);
    expect((await reservar(cookiesEstudiante, "abc")).statusCode).toBe(400);

    const eliminada = await nuevaFranja(30);
    await prisma.disponibilidad.update({ where: { id: eliminada.id }, data: { eliminadaEn: new Date() } });
    expect((await reservar(cookiesEstudiante, eliminada.id)).statusCode).toBe(404);

    const iniciada = await nuevaFranja(-1, 2);
    const respuesta = await reservar(cookiesEstudiante, iniciada.id);
    expect(respuesta.statusCode).toBe(400);
    expect(await estadoFranja(iniciada.id)).toBe("LIBRE");
  });

  it("solo un estudiante puede reservar (RN-001)", async () => {
    const franja = await nuevaFranja(30);
    expect((await reservar(cookiesTutor, franja.id)).statusCode).toBe(403);
    expect((await reservar(cookiesCoordinador, franja.id)).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/api/citas", payload: { disponibilidadId: franja.id } })).statusCode).toBe(401);
    expect(await estadoFranja(franja.id)).toBe("LIBRE");
  });
});

describe("SWR-09: impedir que dos estudiantes reserven la misma franja", () => {
  it("la segunda reserva sobre una franja ocupada se rechaza con 409", async () => {
    const franja = await nuevaFranja(30);
    expect((await reservar(cookiesEstudiante, franja.id)).statusCode).toBe(201);

    const otra = await reservar(cookiesOtroEstudiante, franja.id);
    expect(otra.statusCode).toBe(409);
    expect(otra.json().message).toContain("reservada");

    const mismo = await reservar(cookiesEstudiante, franja.id);
    expect(mismo.statusCode).toBe(409);
    expect(await prisma.cita.count({ where: { franjaId: franja.id } })).toBe(1);
  });

  it("con reservas simultaneas desde varias cuentas, exactamente una tiene exito", async () => {
    const franja = await nuevaFranja(30);

    const respuestas = await Promise.all(cookiesRivales.map((cookies) => reservar(cookies, franja.id)));

    expect(respuestas.map((r) => r.statusCode).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await prisma.cita.count({ where: { franjaId: franja.id, estado: { in: ["PENDIENTE", "APROBADA"] } } })).toBe(1);
    expect(await estadoFranja(franja.id)).toBe("RESERVADA");
  });

  it("la base de datos lo impone aunque se omita la API (defensa en profundidad)", async () => {
    const franja = await nuevaFranja(30);
    await prisma.cita.create({ data: { estudianteId: estudiante.id, franjaId: franja.id } });

    await expect(prisma.cita.create({ data: { estudianteId: otroEstudiante.id, franjaId: franja.id } })).rejects.toThrow();
    // Una cita terminal no cuenta como activa: la franja puede volver a reservarse.
    await prisma.cita.updateMany({ where: { franjaId: franja.id }, data: { estado: "CANCELADA" } });
    await expect(prisma.cita.create({ data: { estudianteId: otroEstudiante.id, franjaId: franja.id } })).resolves.toBeDefined();
  });
});

describe("SWR-10: aprobar una solicitud pendiente", () => {
  it("cambia el estado de la cita a Aprobada y lo registra en el historial", async () => {
    const { franja, citaId } = await citaPendiente();

    const response = await aprobar(citaId);

    expect(response.statusCode).toBe(200);
    expect(response.json().cita.estado).toBe("APROBADA");
    expect(await estadoCita(citaId)).toBe("APROBADA");
    expect(await estadoFranja(franja.id)).toBe("RESERVADA");

    const historial = await prisma.historialEstadoCita.findMany({ where: { citaId }, orderBy: { creadoEn: "asc" } });
    expect(historial.map((h) => h.estadoNuevo)).toEqual(["PENDIENTE", "APROBADA"]);
    expect(historial[1].actorId).toBe(tutor.id);
  });

  it("no se puede aprobar dos veces ni una solicitud que ya no esta pendiente", async () => {
    const { citaId } = await citaPendiente();
    await aprobar(citaId);

    const otraVez = await aprobar(citaId);
    expect(otraVez.statusCode).toBe(409);
  });

  it("solo el tutor dueño de la franja puede aprobar (RN-001)", async () => {
    const { citaId } = await citaPendiente();

    expect((await aprobar(citaId, cookiesEstudiante)).statusCode).toBe(403);
    expect((await aprobar(citaId, cookiesOtroTutor)).statusCode).toBe(404);
    expect(await estadoCita(citaId)).toBe("PENDIENTE");
  });
});

describe("SWR-12 y SWR-19: rechazar una solicitud con motivo", () => {
  it("exige un motivo: sin motivo o con solo espacios la solicitud sigue pendiente", async () => {
    const { franja, citaId } = await citaPendiente();

    expect((await post(cookiesTutor, `/api/citas/${citaId}/rechazar`, {})).statusCode).toBe(400);
    expect((await post(cookiesTutor, `/api/citas/${citaId}/rechazar`, { motivo: "   " })).statusCode).toBe(400);

    expect(await estadoCita(citaId)).toBe("PENDIENTE");
    expect(await estadoFranja(franja.id)).toBe("RESERVADA");
  });

  it("almacena el motivo, deja la cita Rechazada y libera la franja (RN-007)", async () => {
    const { franja, citaId } = await citaPendiente();

    const response = await post(cookiesTutor, `/api/citas/${citaId}/rechazar`, { motivo: "  Estaré en una reunión  " });

    expect(response.statusCode).toBe(200);
    expect(response.json().cita.estado).toBe("RECHAZADA");
    expect(response.json().cita.motivoRechazo).toBe("Estaré en una reunión");

    const enBase = await prisma.cita.findUniqueOrThrow({ where: { id: citaId } });
    expect(enBase.estado).toBe("RECHAZADA");
    expect(enBase.motivoRechazo).toBe("Estaré en una reunión");
    expect(await estadoFranja(franja.id)).toBe("LIBRE");
    expect(await disponiblesDe(tutor.id)).toContain(franja.id);
  });

  it("una cita rechazada no puede aprobarse despues", async () => {
    const { citaId } = await citaPendiente();
    await post(cookiesTutor, `/api/citas/${citaId}/rechazar`, { motivo: "No puedo" });

    expect((await aprobar(citaId)).statusCode).toBe(409);
  });

  it("la franja liberada puede reservarla otro estudiante", async () => {
    const { franja, citaId } = await citaPendiente();
    await post(cookiesTutor, `/api/citas/${citaId}/rechazar`, { motivo: "No puedo" });

    expect((await reservar(cookiesOtroEstudiante, franja.id)).statusCode).toBe(201);
  });

  it("la base de datos exige el motivo aunque se omita la API", async () => {
    const { citaId } = await citaPendiente();

    await expect(prisma.cita.update({ where: { id: citaId }, data: { estado: "RECHAZADA" } })).rejects.toThrow();
    await expect(prisma.cita.update({ where: { id: citaId }, data: { estado: "RECHAZADA", motivoRechazo: "  " } })).rejects.toThrow();
  });
});

describe("SWR-11: reprogramar proponiendo otra fecha y hora", () => {
  it("registra la nueva franja propuesta, libera la original y reserva la nueva", async () => {
    const { franja: original, citaId } = await citaPendiente(30);
    const nueva = await nuevaFranja(50);

    const response = await post(cookiesTutor, `/api/citas/${citaId}/reprogramar`, { disponibilidadId: nueva.id });

    expect(response.statusCode).toBe(200);
    const { cita } = response.json();
    expect(cita.estado).toBe("PENDIENTE");
    expect(cita.franja.id).toBe(nueva.id);
    expect(cita.propuestaPendiente.franjaOriginal.id).toBe(original.id);

    expect(await estadoFranja(original.id)).toBe("LIBRE");
    expect(await estadoFranja(nueva.id)).toBe("RESERVADA");

    const propuesta = await prisma.propuestaReprogramacion.findFirstOrThrow({ where: { citaId } });
    expect(propuesta).toMatchObject({ franjaOriginalId: original.id, franjaNuevaId: nueva.id, estado: "PENDIENTE" });
  });

  it("mientras la propuesta espera respuesta no se puede aprobar, rechazar ni reprogramar de nuevo", async () => {
    const { citaId } = await citaPendiente(30);
    const nueva = await nuevaFranja(50);
    const otra = await nuevaFranja(70);
    await post(cookiesTutor, `/api/citas/${citaId}/reprogramar`, { disponibilidadId: nueva.id });

    expect((await aprobar(citaId)).statusCode).toBe(409);
    expect((await post(cookiesTutor, `/api/citas/${citaId}/rechazar`, { motivo: "x" })).statusCode).toBe(409);
    expect((await post(cookiesTutor, `/api/citas/${citaId}/reprogramar`, { disponibilidadId: otra.id })).statusCode).toBe(409);
  });

  it("valida la franja propuesta: debe ser propia, libre, futura y distinta de la actual", async () => {
    const { franja: actual, citaId } = await citaPendiente(30);
    const ajena = await nuevaFranja(50, 1, otroTutor.id);
    const ocupada = await nuevaFranja(60);
    await reservar(cookiesOtroEstudiante, ocupada.id);
    const pasada = await nuevaFranja(-3, 1);

    const intentar = (disponibilidadId: string) => post(cookiesTutor, `/api/citas/${citaId}/reprogramar`, { disponibilidadId });

    expect((await intentar(ajena.id)).statusCode).toBe(404);
    expect((await intentar(ocupada.id)).statusCode).toBe(409);
    expect((await intentar(pasada.id)).statusCode).toBe(400);
    expect((await intentar(actual.id)).statusCode).toBe(400);
    expect((await intentar("00000000-0000-4000-8000-000000000000")).statusCode).toBe(404);
    expect(await estadoFranja(actual.id)).toBe("RESERVADA");
  });

  it("el estudiante acepta la propuesta: la cita queda Aprobada en la nueva franja", async () => {
    const { citaId } = await citaPendiente(30);
    const nueva = await nuevaFranja(50);
    await post(cookiesTutor, `/api/citas/${citaId}/reprogramar`, { disponibilidadId: nueva.id });

    const response = await post(cookiesEstudiante, `/api/citas/${citaId}/propuesta/aceptar`);

    expect(response.statusCode).toBe(200);
    expect(response.json().cita.estado).toBe("APROBADA");
    expect(response.json().cita.propuestaPendiente).toBeNull();
    expect(await estadoFranja(nueva.id)).toBe("RESERVADA");
    expect((await prisma.propuestaReprogramacion.findFirstOrThrow({ where: { citaId } })).estado).toBe("ACEPTADA");
  });

  it("el estudiante rechaza la propuesta: la cita queda Cancelada y la franja nueva se libera", async () => {
    const { franja: original, citaId } = await citaPendiente(30);
    const nueva = await nuevaFranja(50);
    await post(cookiesTutor, `/api/citas/${citaId}/reprogramar`, { disponibilidadId: nueva.id });

    const response = await post(cookiesEstudiante, `/api/citas/${citaId}/propuesta/rechazar`);

    expect(response.statusCode).toBe(200);
    expect(response.json().cita.estado).toBe("CANCELADA");
    expect(await estadoFranja(nueva.id)).toBe("LIBRE");
    expect(await estadoFranja(original.id)).toBe("LIBRE");
    expect((await prisma.propuestaReprogramacion.findFirstOrThrow({ where: { citaId } })).estado).toBe("RECHAZADA");
  });

  it("solo el estudiante de la cita responde la propuesta y solo si existe una", async () => {
    const { citaId } = await citaPendiente(30);
    expect((await post(cookiesEstudiante, `/api/citas/${citaId}/propuesta/aceptar`)).statusCode).toBe(409);

    const nueva = await nuevaFranja(50);
    await post(cookiesTutor, `/api/citas/${citaId}/reprogramar`, { disponibilidadId: nueva.id });

    expect((await post(cookiesOtroEstudiante, `/api/citas/${citaId}/propuesta/aceptar`)).statusCode).toBe(404);
    expect((await post(cookiesTutor, `/api/citas/${citaId}/propuesta/aceptar`)).statusCode).toBe(403);
  });

  it("deja la bitacora completa de la cita (BR-04)", async () => {
    const { citaId } = await citaPendiente(30);
    const nueva = await nuevaFranja(50);
    await post(cookiesTutor, `/api/citas/${citaId}/reprogramar`, { disponibilidadId: nueva.id });
    await post(cookiesEstudiante, `/api/citas/${citaId}/propuesta/aceptar`);

    const historial = await prisma.historialEstadoCita.findMany({ where: { citaId }, orderBy: { creadoEn: "asc" } });
    expect(historial.map((h) => [h.estadoAnterior, h.estadoNuevo, h.actorId])).toEqual([
      [null, "PENDIENTE", estudiante.id],
      ["PENDIENTE", "PENDIENTE", tutor.id],
      ["PENDIENTE", "APROBADA", estudiante.id],
    ]);
  });
});

describe("SWR-13: finalizar una cita una vez concluida la sesion", () => {
  it("finaliza una cita aprobada cuya hora de inicio ya paso", async () => {
    const franja = await crearFranja(tutor.id, materia.id, instante(-2), instante(-1), "RESERVADA");
    const cita = await prisma.cita.create({ data: { estudianteId: estudiante.id, franjaId: franja.id, estado: "APROBADA" } });

    const response = await post(cookiesTutor, `/api/citas/${cita.id}/finalizar`);

    expect(response.statusCode).toBe(200);
    expect(response.json().cita.estado).toBe("FINALIZADA");
    expect(response.json().cita.fechaFinalizacion).not.toBeNull();
    expect(await estadoCita(cita.id)).toBe("FINALIZADA");
    expect(await estadoFranja(franja.id)).toBe("RESERVADA");
  });

  it("no finaliza antes de la hora de inicio", async () => {
    const { citaId } = await citaPendiente(10);
    await aprobar(citaId);

    const response = await post(cookiesTutor, `/api/citas/${citaId}/finalizar`);

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain("hora de inicio");
    expect(await estadoCita(citaId)).toBe("APROBADA");
  });

  it("solo se finaliza una cita aprobada", async () => {
    const franja = await crearFranja(tutor.id, materia.id, instante(-2), instante(-1), "RESERVADA");
    const cita = await prisma.cita.create({ data: { estudianteId: estudiante.id, franjaId: franja.id, estado: "PENDIENTE" } });

    expect((await post(cookiesTutor, `/api/citas/${cita.id}/finalizar`)).statusCode).toBe(409);
  });

  it("solo el tutor de la cita puede finalizarla (RN-001)", async () => {
    const franja = await crearFranja(tutor.id, materia.id, instante(-2), instante(-1), "RESERVADA");
    const cita = await prisma.cita.create({ data: { estudianteId: estudiante.id, franjaId: franja.id, estado: "APROBADA" } });

    expect((await post(cookiesEstudiante, `/api/citas/${cita.id}/finalizar`)).statusCode).toBe(403);
    expect((await post(cookiesOtroTutor, `/api/citas/${cita.id}/finalizar`)).statusCode).toBe(404);
    expect(await estadoCita(cita.id)).toBe("APROBADA");
  });
});

describe("SWR-14: el estudiante y el tutor ven el estado actual de cada cita", () => {
  const listar = async (cookies: Cookies) => {
    const response = await app.inject({ method: "GET", url: "/api/citas", cookies });
    return { response, citas: response.json().citas as Array<{ id: string; estado: string; materia: string; tutor: { nombre: string }; estudiante: { nombre: string } }> };
  };

  it("ambos paneles muestran el mismo estado antes y despues de cada cambio", async () => {
    const { citaId } = await citaPendiente();

    const delEstudiante = (await listar(cookiesEstudiante)).citas.find((c) => c.id === citaId)!;
    const delTutor = (await listar(cookiesTutor)).citas.find((c) => c.id === citaId)!;
    expect(delEstudiante.estado).toBe("PENDIENTE");
    expect(delTutor.estado).toBe(delEstudiante.estado);
    expect(delTutor.estudiante.nombre).toBe("Estudiante");
    expect(delEstudiante.tutor.nombre).toBe("Tutor");

    await aprobar(citaId);

    const tras = {
      estudiante: (await listar(cookiesEstudiante)).citas.find((c) => c.id === citaId)!,
      tutor: (await listar(cookiesTutor)).citas.find((c) => c.id === citaId)!,
    };
    expect(tras.estudiante.estado).toBe("APROBADA");
    expect(tras.tutor.estado).toBe("APROBADA");
  });

  it("cada usuario ve solo sus propias citas", async () => {
    const { citaId } = await citaPendiente();

    expect((await listar(cookiesOtroEstudiante)).citas.map((c) => c.id)).not.toContain(citaId);
    expect((await listar(cookiesOtroTutor)).citas.map((c) => c.id)).not.toContain(citaId);
  });

  it("la lista exige sesion y un rol que participe en citas", async () => {
    expect((await app.inject({ method: "GET", url: "/api/citas" })).statusCode).toBe(401);
    expect((await listar(cookiesCoordinador)).response.statusCode).toBe(403);
  });

  it("muestra el motivo del rechazo al estudiante", async () => {
    const { citaId } = await citaPendiente();
    await post(cookiesTutor, `/api/citas/${citaId}/rechazar`, { motivo: "Tengo clase" });

    const cita = (await listar(cookiesEstudiante)).citas.find((c) => c.id === citaId) as unknown as { estado: string; motivoRechazo: string };
    expect(cita.estado).toBe("RECHAZADA");
    expect(cita.motivoRechazo).toBe("Tengo clase");
  });
});

describe("SWR-21 y SWR-22: cancelar una cita y liberar la franja", () => {
  it("cancela una cita Pendiente y la franja vuelve a estar disponible", async () => {
    const { franja, citaId } = await citaPendiente();
    expect(await disponiblesDe(tutor.id)).not.toContain(franja.id);

    const response = await cancelar(citaId);

    expect(response.statusCode).toBe(200);
    expect(response.json().cita.estado).toBe("CANCELADA");
    expect(await estadoCita(citaId)).toBe("CANCELADA");
    expect(await estadoFranja(franja.id)).toBe("LIBRE");
    expect(await disponiblesDe(tutor.id)).toContain(franja.id);
  });

  it("cancela una cita Aprobada y otro estudiante puede reservar esa franja", async () => {
    const { franja, citaId } = await citaPendiente();
    await aprobar(citaId);

    expect((await cancelar(citaId)).json().cita.estado).toBe("CANCELADA");
    expect(await estadoFranja(franja.id)).toBe("LIBRE");

    const nueva = await reservar(cookiesOtroEstudiante, franja.id);
    expect(nueva.statusCode).toBe(201);
    expect(nueva.json().cita.estudiante.id).toBe(otroEstudiante.id);
  });

  it("no cancela una cita Rechazada, Cancelada o Finalizada", async () => {
    const rechazada = await citaPendiente(30);
    await post(cookiesTutor, `/api/citas/${rechazada.citaId}/rechazar`, { motivo: "No" });
    const cancelada = await citaPendiente(40);
    await cancelar(cancelada.citaId);
    const franjaPasada = await crearFranja(tutor.id, materia.id, instante(-2), instante(-1), "RESERVADA");
    const finalizada = await prisma.cita.create({ data: { estudianteId: estudiante.id, franjaId: franjaPasada.id, estado: "FINALIZADA" } });

    for (const id of [rechazada.citaId, cancelada.citaId, finalizada.id]) {
      expect((await cancelar(id)).statusCode).toBe(409);
    }
    expect(await estadoFranja(franjaPasada.id)).toBe("RESERVADA");
  });

  it("cancelar con una propuesta pendiente la descarta y libera la franja propuesta", async () => {
    const { citaId } = await citaPendiente(30);
    const nueva = await nuevaFranja(50);
    await post(cookiesTutor, `/api/citas/${citaId}/reprogramar`, { disponibilidadId: nueva.id });

    expect((await cancelar(citaId)).json().cita.estado).toBe("CANCELADA");

    expect(await estadoFranja(nueva.id)).toBe("LIBRE");
    expect((await prisma.propuestaReprogramacion.findFirstOrThrow({ where: { citaId } })).estado).toBe("RECHAZADA");
  });

  it("solo el estudiante dueño de la cita puede cancelarla (RN-001)", async () => {
    const { franja, citaId } = await citaPendiente();

    expect((await cancelar(citaId, cookiesOtroEstudiante)).statusCode).toBe(404);
    expect((await cancelar(citaId, cookiesTutor)).statusCode).toBe(403);
    expect(await estadoCita(citaId)).toBe("PENDIENTE");
    expect(await estadoFranja(franja.id)).toBe("RESERVADA");
  });

  it("aprobar y cancelar al mismo tiempo no deja la cita en un estado inconsistente", async () => {
    const { franja, citaId } = await citaPendiente();

    await Promise.all([aprobar(citaId), cancelar(citaId)]);

    const estado = await estadoCita(citaId);
    expect(["APROBADA", "CANCELADA"]).toContain(estado);
    expect(await estadoFranja(franja.id)).toBe(estado === "CANCELADA" ? "LIBRE" : "RESERVADA");
  });
});
