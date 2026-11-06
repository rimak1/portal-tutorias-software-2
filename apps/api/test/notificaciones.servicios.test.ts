import { beforeEach, describe, expect, it } from "vitest";
import { CambiosDeCita, registrarEnHistorial } from "../src/modules/citas/citas.eventos.js";
import { CitasDelEstudianteService } from "../src/modules/citas/citas-del-estudiante.service.js";
import { CitasDelTutorService } from "../src/modules/citas/citas-del-tutor.service.js";
import { EjecutorDeTransiciones } from "../src/modules/citas/ejecutor-de-transiciones.js";
import { notificarCambioDeCita, redactarAviso } from "../src/modules/notificaciones/notificar-cambio-de-cita.js";
import { NotificacionesService } from "../src/modules/notificaciones/notificaciones.service.js";
import type { CambioDeEstadoDeCita } from "../src/modules/citas/citas.eventos.js";
import type { CitaConRelaciones } from "../src/modules/citas/citas.puertos.js";
import { MundoEnMemoria, RelojFijo } from "./fakes.js";

const AHORA = new Date("2026-11-10T15:00:00Z");
const HORA = 3_600_000;
// 2026-11-12 15:00 UTC = jueves 10:00 a. m. en Colombia (UTC-5).
const INICIO = new Date("2026-11-12T15:00:00Z");

function citaDePrueba(sobreescribir: Partial<CitaConRelaciones> = {}): CitaConRelaciones {
  return {
    id: "cita-1",
    estado: "PENDIENTE",
    motivoRechazo: null,
    creadoEn: AHORA,
    fechaFinalizacion: null,
    estudiante: { id: "est", nombre: "Ana Estudiante" },
    franja: { id: "f", fechaInicio: INICIO, fechaFin: new Date(INICIO.getTime() + HORA), materia: { nombre: "Cálculo I" }, tutor: { id: "tut", nombre: "Luis Tutor" } },
    propuestas: [],
    ...sobreescribir,
  };
}

const cambio = (sobreescribir: Partial<CambioDeEstadoDeCita>): CambioDeEstadoDeCita => ({
  citaId: "cita-1",
  estadoAnterior: "PENDIENTE",
  estadoNuevo: "APROBADA",
  actorId: "tut",
  detalle: "Solicitud aprobada",
  ...sobreescribir,
});

describe("redactarAviso: a quién se avisa y qué se dice (F-07)", () => {
  it("una reserva nueva avisa al tutor, con la materia y el horario en hora de Colombia", () => {
    const aviso = redactarAviso(cambio({ estadoAnterior: null, estadoNuevo: "PENDIENTE", actorId: "est" }), citaDePrueba());

    expect(aviso.usuarioId).toBe("tut");
    expect(aviso.citaId).toBe("cita-1");
    expect(aviso.titulo).toBe("Nueva solicitud de tutoría");
    expect(aviso.texto).toContain("Ana Estudiante");
    expect(aviso.texto).toContain("Cálculo I");
    expect(aviso.texto).toMatch(/jueves, 12 de noviembre/);
    expect(aviso.texto).toMatch(/10:00/);
  });

  it("los textos terminan en un solo punto, aunque la hora o el motivo ya terminen en punto", () => {
    const reserva = redactarAviso(cambio({ estadoAnterior: null, estadoNuevo: "PENDIENTE", actorId: "est" }), citaDePrueba());
    const rechazo = redactarAviso(
      cambio({ estadoNuevo: "RECHAZADA", detalle: "No atiendo." }),
      citaDePrueba({ estado: "RECHAZADA", motivoRechazo: "No atiendo." }),
    );

    expect(reserva.texto).toMatch(/a\.\sm\.$/);
    expect(reserva.texto).not.toMatch(/\.\.$/);
    expect(rechazo.texto).toMatch(/Motivo: No atiendo\.$/);
  });

  it("aprobar avisa al estudiante", () => {
    const aviso = redactarAviso(cambio({}), citaDePrueba({ estado: "APROBADA" }));
    expect(aviso).toMatchObject({ usuarioId: "est", titulo: "Tu tutoría fue aprobada" });
    expect(aviso.texto).toContain("Luis Tutor");
  });

  it("rechazar avisa al estudiante e incluye el motivo", () => {
    const aviso = redactarAviso(
      cambio({ estadoNuevo: "RECHAZADA", detalle: "No atiendo ese día" }),
      citaDePrueba({ estado: "RECHAZADA", motivoRechazo: "No atiendo ese día" }),
    );
    expect(aviso).toMatchObject({ usuarioId: "est", titulo: "Tu solicitud fue rechazada" });
    expect(aviso.texto).toContain("Motivo: No atiendo ese día");
  });

  it("proponer otro horario avisa al estudiante con la fecha nueva", () => {
    const aviso = redactarAviso(
      cambio({ estadoNuevo: "PENDIENTE", detalle: "Reprogramación propuesta por el tutor" }),
      citaDePrueba(),
    );
    expect(aviso).toMatchObject({ usuarioId: "est", titulo: "Propuesta de reprogramación" });
    expect(aviso.texto).toMatch(/jueves, 12 de noviembre/);
  });

  it("aceptar la propuesta avisa al tutor, no al estudiante que la aceptó", () => {
    const aviso = redactarAviso(
      cambio({ actorId: "est", detalle: "Propuesta de reprogramación aceptada" }),
      citaDePrueba({ estado: "APROBADA" }),
    );
    expect(aviso).toMatchObject({ usuarioId: "tut", titulo: "Reprogramación aceptada" });
    expect(aviso.texto).toContain("Ana Estudiante");
  });

  it("cancelar avisa al tutor; rechazar la propuesta también, con su propio título", () => {
    const cancelada = redactarAviso(
      cambio({ actorId: "est", estadoNuevo: "CANCELADA", detalle: "Cita cancelada por el estudiante" }),
      citaDePrueba({ estado: "CANCELADA" }),
    );
    const propuestaRechazada = redactarAviso(
      cambio({ actorId: "est", estadoNuevo: "CANCELADA", detalle: "Propuesta de reprogramación rechazada" }),
      citaDePrueba({ estado: "CANCELADA" }),
    );
    expect(cancelada).toMatchObject({ usuarioId: "tut", titulo: "Tutoría cancelada" });
    expect(propuestaRechazada).toMatchObject({ usuarioId: "tut", titulo: "Reprogramación rechazada" });
  });

  it("finalizar avisa al estudiante", () => {
    const aviso = redactarAviso(cambio({ estadoAnterior: "APROBADA", estadoNuevo: "FINALIZADA", detalle: "Tutoría finalizada" }), citaDePrueba({ estado: "FINALIZADA" }));
    expect(aviso).toMatchObject({ usuarioId: "est", titulo: "Tutoría finalizada" });
  });
});

describe("el suscriptor genera los avisos dentro de la transacción del cambio", () => {
  let mundo: MundoEnMemoria;
  let reloj: RelojFijo;
  let estudiante: CitasDelEstudianteService;
  let tutor: CitasDelTutorService;
  let franja: string;

  beforeEach(() => {
    mundo = new MundoEnMemoria();
    reloj = new RelojFijo(AHORA);
    mundo.agregarTutor("tut", "Luis Tutor");
    mundo.agregarEstudiante("est", "Ana Estudiante");
    franja = mundo.agregarFranja("tut", INICIO, new Date(INICIO.getTime() + HORA));

    const cambios = new CambiosDeCita();
    cambios.suscribir(registrarEnHistorial);
    cambios.suscribir(notificarCambioDeCita);
    const transiciones = new EjecutorDeTransiciones(mundo, cambios, reloj);
    estudiante = new CitasDelEstudianteService(mundo, cambios, transiciones, reloj);
    tutor = new CitasDelTutorService(mundo, transiciones, reloj);
  });

  const avisosDe = (usuarioId: string) => mundo.datos.notificaciones.filter((n) => n.usuarioId === usuarioId);

  it("reservar avisa al tutor y aprobar avisa al estudiante, cada uno solo de lo que le corresponde", async () => {
    const cita = await estudiante.reservar("est", franja);
    expect(avisosDe("tut").map((n) => n.titulo)).toEqual(["Nueva solicitud de tutoría"]);
    expect(avisosDe("est")).toEqual([]);

    await tutor.aprobar("tut", cita.id);
    expect(avisosDe("est").map((n) => n.titulo)).toEqual(["Tu tutoría fue aprobada"]);
    expect(avisosDe("tut")).toHaveLength(1);
  });

  it("si el aviso no se puede guardar, el cambio de estado tampoco se confirma", async () => {
    const cita = await estudiante.reservar("est", franja);
    mundo.repos.notificaciones.crear = async () => {
      throw new Error("falla al guardar el aviso");
    };

    await expect(tutor.aprobar("tut", cita.id)).rejects.toThrow("falla al guardar el aviso");

    expect(mundo.cita(cita.id).estado).toBe("PENDIENTE");
    expect(mundo.datos.historial.map((h) => h.estadoNuevo)).toEqual(["PENDIENTE"]);
  });

  it("una acción rechazada por las reglas no deja ningún aviso", async () => {
    const cita = await estudiante.reservar("est", franja);
    const antes = mundo.datos.notificaciones.length;

    await expect(tutor.rechazar("tut", cita.id, "   ")).rejects.toThrow();

    expect(mundo.datos.notificaciones).toHaveLength(antes);
  });
});

describe("NotificacionesService (F-07)", () => {
  let mundo: MundoEnMemoria;
  let servicio: NotificacionesService;

  beforeEach(async () => {
    mundo = new MundoEnMemoria();
    servicio = new NotificacionesService(mundo.repos.notificaciones, new RelojFijo(AHORA));
    await mundo.repos.notificaciones.crear({ usuarioId: "u1", citaId: null, titulo: "Uno", texto: "a" });
    await mundo.repos.notificaciones.crear({ usuarioId: "u1", citaId: null, titulo: "Dos", texto: "b" });
    await mundo.repos.notificaciones.crear({ usuarioId: "u2", citaId: null, titulo: "De otro", texto: "c" });
  });

  it("lista los avisos del usuario, del más reciente al más antiguo, con el contador de no leídos", async () => {
    const { notificaciones, noLeidas } = await servicio.listar("u1");

    expect(notificaciones.map((n) => n.titulo)).toEqual(["Dos", "Uno"]);
    expect(notificaciones.every((n) => !n.leida)).toBe(true);
    expect(noLeidas).toBe(2);
  });

  it("marcar un aviso como leído baja el contador; repetirlo no falla", async () => {
    const [reciente] = (await servicio.listar("u1")).notificaciones;

    await servicio.marcarLeida("u1", reciente.id);
    await servicio.marcarLeida("u1", reciente.id);

    const despues = await servicio.listar("u1");
    expect(despues.noLeidas).toBe(1);
    expect(despues.notificaciones.find((n) => n.id === reciente.id)?.leida).toBe(true);
  });

  it("un aviso ajeno o inexistente es un 404", async () => {
    const ajeno = (await servicio.listar("u2")).notificaciones[0];

    await expect(servicio.marcarLeida("u1", ajeno.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(servicio.marcarLeida("u1", "no-existe")).rejects.toMatchObject({ statusCode: 404 });
    expect((await servicio.listar("u2")).noLeidas).toBe(1);
  });

  it("marcar todas solo afecta al usuario que lo pide", async () => {
    await servicio.marcarTodasLeidas("u1");

    expect((await servicio.listar("u1")).noLeidas).toBe(0);
    expect((await servicio.listar("u2")).noLeidas).toBe(1);
  });
});
