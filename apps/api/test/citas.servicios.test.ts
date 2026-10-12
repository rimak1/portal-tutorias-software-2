import { beforeEach, describe, expect, it } from "vitest";
import { ErrorDeNegocio } from "../src/lib/errors.js";
import { CambiosDeCita, registrarEnHistorial } from "../src/modules/citas/citas.eventos.js";
import { CitasDelEstudianteService } from "../src/modules/citas/citas-del-estudiante.service.js";
import { CitasDelTutorService } from "../src/modules/citas/citas-del-tutor.service.js";
import { EjecutorDeTransiciones } from "../src/modules/citas/ejecutor-de-transiciones.js";
import { MundoEnMemoria, RelojFijo } from "./fakes.js";

/**
 * Casos de uso de citas probados SIN base de datos: los servicios dependen de
 * puertos (repositorios, unidad de trabajo, reloj), asi que aqui se les da una
 * implementacion en memoria y un reloj controlado. La integracion real contra
 * PostgreSQL se sigue cubriendo en citas.routes.test.ts.
 */

const AHORA = new Date("2026-10-20T15:00:00Z");
const enHoras = (h: number) => new Date(AHORA.getTime() + h * 3600_000);

let reloj: RelojFijo;
let mundo: MundoEnMemoria;
let estudiante: CitasDelEstudianteService;
let tutor: CitasDelTutorService;

beforeEach(() => {
  reloj = new RelojFijo(AHORA);
  mundo = new MundoEnMemoria();
  mundo.agregarTutor("tutor-1", "Tutor Uno");
  mundo.agregarTutor("tutor-2", "Tutor Dos");
  mundo.agregarEstudiante("est-1", "Estudiante Uno");
  mundo.agregarEstudiante("est-2", "Estudiante Dos");

  const cambios = new CambiosDeCita();
  cambios.suscribir(registrarEnHistorial);
  const transiciones = new EjecutorDeTransiciones(mundo, cambios, reloj);
  estudiante = new CitasDelEstudianteService(mundo, cambios, transiciones, reloj);
  tutor = new CitasDelTutorService(mundo, transiciones, reloj);
});

const falla = async (promesa: Promise<unknown>, statusCode: number) => {
  const error = await promesa.then(
    () => null,
    (e) => e,
  );
  expect(error).toBeInstanceOf(ErrorDeNegocio);
  expect((error as ErrorDeNegocio).statusCode).toBe(statusCode);
};

describe("reservar (SWR-08, SWR-09)", () => {
  it("crea la cita Pendiente, reserva la franja y deja constancia en la bitacora", async () => {
    const franjaId = mundo.agregarFranja("tutor-1", enHoras(24), enHoras(25));

    const cita = await estudiante.reservar("est-1", franjaId);

    expect(cita.estado).toBe("PENDIENTE");
    expect(cita.tutor.nombre).toBe("Tutor Uno");
    expect(mundo.franja(franjaId).estado).toBe("RESERVADA");
    expect(mundo.datos.historial).toEqual([
      { citaId: cita.id, estadoAnterior: null, estadoNuevo: "PENDIENTE", actorId: "est-1", detalle: "Solicitud de tutoría creada" },
    ]);
  });

  it("una franja ya reservada se rechaza con 409 y no crea otra cita", async () => {
    const franjaId = mundo.agregarFranja("tutor-1", enHoras(24), enHoras(25));
    await estudiante.reservar("est-1", franjaId);

    await falla(estudiante.reservar("est-2", franjaId), 409);

    expect(mundo.datos.citas.size).toBe(1);
  });

  it("una franja que comienza exactamente ahora ya no se puede reservar; un instante despues si", async () => {
    const ahoraMismo = mundo.agregarFranja("tutor-1", AHORA, enHoras(1));
    const unMilisegundoDespues = mundo.agregarFranja("tutor-2", new Date(AHORA.getTime() + 1), enHoras(1));

    await falla(estudiante.reservar("est-1", ahoraMismo), 400);
    await expect(estudiante.reservar("est-1", unMilisegundoDespues)).resolves.toMatchObject({ estado: "PENDIENTE" });
  });

  it("el paso del tiempo cambia el resultado sin tocar datos: la misma franja deja de estar disponible", async () => {
    const franjaId = mundo.agregarFranja("tutor-1", enHoras(2), enHoras(3));

    reloj.avanzarHoras(3);

    await falla(estudiante.reservar("est-1", franjaId), 400);
  });

  it("la franja de un tutor desactivado o inexistente responde 404", async () => {
    mundo.agregarTutor("tutor-inactivo", "Inactivo", false);
    const franjaId = mundo.agregarFranja("tutor-inactivo", enHoras(24), enHoras(25));

    await falla(estudiante.reservar("est-1", franjaId), 404);
    await falla(estudiante.reservar("est-1", "no-existe"), 404);
  });
});

describe("finalizar (SWR-13) con el reloj controlado", () => {
  const citaAprobada = () => {
    const franjaId = mundo.agregarFranja("tutor-1", enHoras(1), enHoras(2), "RESERVADA");
    return mundo.agregarCita("est-1", franjaId, "APROBADA");
  };

  it("un milisegundo antes de la hora de inicio se rechaza", async () => {
    const citaId = citaAprobada();
    reloj.avanzarHoras(1);
    const justoAntes = new RelojFijo(new Date(enHoras(1).getTime() - 1));
    const cambios = new CambiosDeCita();
    const tardio = new CitasDelTutorService(mundo, new EjecutorDeTransiciones(mundo, cambios, justoAntes), justoAntes);

    await falla(tardio.finalizar("tutor-1", citaId), 409);
    expect(mundo.cita(citaId).estado).toBe("APROBADA");
  });

  it("en la hora exacta de inicio se permite y registra la fecha de finalizacion con el reloj", async () => {
    const citaId = citaAprobada();
    reloj.avanzarHoras(1);

    const cita = await tutor.finalizar("tutor-1", citaId);

    expect(cita.estado).toBe("FINALIZADA");
    expect(cita.fechaFinalizacion).toBe(enHoras(1).toISOString());
  });

  it("antes de que llegue la hora se rechaza y despues de avanzar el reloj se permite", async () => {
    const citaId = citaAprobada();

    await falla(tutor.finalizar("tutor-1", citaId), 409);
    reloj.avanzarHoras(1.5);

    await expect(tutor.finalizar("tutor-1", citaId)).resolves.toMatchObject({ estado: "FINALIZADA" });
  });
});

describe("cancelar (SWR-21, SWR-22)", () => {
  it("cancela, libera la franja y lo anota en la bitacora con su actor", async () => {
    const franjaId = mundo.agregarFranja("tutor-1", enHoras(24), enHoras(25));
    const { id } = await estudiante.reservar("est-1", franjaId);

    const cita = await estudiante.cancelar("est-1", id);

    expect(cita.estado).toBe("CANCELADA");
    expect(mundo.franja(franjaId).estado).toBe("LIBRE");
    expect(mundo.datos.historial.at(-1)).toMatchObject({ estadoAnterior: "PENDIENTE", estadoNuevo: "CANCELADA", actorId: "est-1" });
  });

  it("otro estudiante recibe 404 y no cambia nada", async () => {
    const franjaId = mundo.agregarFranja("tutor-1", enHoras(24), enHoras(25));
    const { id } = await estudiante.reservar("est-1", franjaId);

    await falla(estudiante.cancelar("est-2", id), 404);

    expect(mundo.cita(id).estado).toBe("PENDIENTE");
    expect(mundo.franja(franjaId).estado).toBe("RESERVADA");
  });
});

describe("rechazar y reprogramar (SWR-11, SWR-12, SWR-19)", () => {
  it("rechazar exige motivo, lo guarda y libera la franja", async () => {
    const franjaId = mundo.agregarFranja("tutor-1", enHoras(24), enHoras(25));
    const { id } = await estudiante.reservar("est-1", franjaId);

    await falla(tutor.rechazar("tutor-1", id, "   "), 400);
    const cita = await tutor.rechazar("tutor-1", id, "  Tengo comite  ");

    expect(cita).toMatchObject({ estado: "RECHAZADA", motivoRechazo: "Tengo comite" });
    expect(mundo.franja(franjaId).estado).toBe("LIBRE");
  });

  it("reprogramar libera la original, reserva la nueva y deja una propuesta pendiente", async () => {
    const original = mundo.agregarFranja("tutor-1", enHoras(24), enHoras(25));
    const nueva = mundo.agregarFranja("tutor-1", enHoras(48), enHoras(49));
    const { id } = await estudiante.reservar("est-1", original);

    const cita = await tutor.reprogramar("tutor-1", id, nueva);

    expect(cita.franja.id).toBe(nueva);
    expect(cita.propuestaPendiente?.franjaOriginal.id).toBe(original);
    expect(mundo.franja(original).estado).toBe("LIBRE");
    expect(mundo.franja(nueva).estado).toBe("RESERVADA");
  });

  it("una propuesta con una franja que ya comenzo segun el reloj se rechaza y no cambia nada", async () => {
    const original = mundo.agregarFranja("tutor-1", enHoras(24), enHoras(25));
    const pasada = mundo.agregarFranja("tutor-1", enHoras(-3), enHoras(-2));
    const { id } = await estudiante.reservar("est-1", original);

    await falla(tutor.reprogramar("tutor-1", id, pasada), 400);

    expect(mundo.franja(original).estado).toBe("RESERVADA");
    expect(mundo.datos.propuestas).toHaveLength(0);
  });

  it("aceptar la propuesta deja la cita Aprobada y rechazarla la cancela liberando la franja nueva", async () => {
    const original = mundo.agregarFranja("tutor-1", enHoras(24), enHoras(25));
    const nueva = mundo.agregarFranja("tutor-1", enHoras(48), enHoras(49));
    const otra = mundo.agregarFranja("tutor-1", enHoras(72), enHoras(73));
    const primera = await estudiante.reservar("est-1", original);
    await tutor.reprogramar("tutor-1", primera.id, nueva);
    const segunda = await estudiante.reservar("est-2", otra);
    const otraNueva = mundo.agregarFranja("tutor-1", enHoras(96), enHoras(97));
    await tutor.reprogramar("tutor-1", segunda.id, otraNueva);

    expect((await estudiante.aceptarPropuesta("est-1", primera.id)).estado).toBe("APROBADA");
    expect((await estudiante.rechazarPropuesta("est-2", segunda.id)).estado).toBe("CANCELADA");

    expect(mundo.franja(nueva).estado).toBe("RESERVADA");
    expect(mundo.franja(otraNueva).estado).toBe("LIBRE");
  });
});

describe("listar por actor (SWR-14)", () => {
  it("cada servicio devuelve solo las citas de su actor, sin ramas por rol", async () => {
    const franjaId = mundo.agregarFranja("tutor-1", enHoras(24), enHoras(25));
    const { id } = await estudiante.reservar("est-1", franjaId);

    expect((await estudiante.listar("est-1")).map((c) => c.id)).toEqual([id]);
    expect(await estudiante.listar("est-2")).toEqual([]);
    expect((await tutor.listar("tutor-1")).map((c) => c.id)).toEqual([id]);
    expect(await tutor.listar("tutor-2")).toEqual([]);
  });
});
