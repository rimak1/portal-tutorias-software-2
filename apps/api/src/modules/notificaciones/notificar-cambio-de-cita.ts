import type { CambioDeEstadoDeCita, SuscriptorDeCambios } from "../citas/citas.eventos.js";
import type { CitaConRelaciones } from "../citas/citas.puertos.js";
import type { NuevaNotificacion } from "./notificaciones.puertos.js";

/** Las franjas se publican en hora de Colombia; los avisos las muestran así sin importar la zona del servidor. */
const ZONA_HORARIA = "America/Bogota";

const formatoDeFranja = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA_HORARIA,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

/** El formato de la hora termina en punto ("10:00 a. m."): se agrega el punto final solo si falta. */
const comoFrase = (texto: string) => (texto.endsWith(".") ? texto : `${texto}.`);

/**
 * Redacta el aviso de un cambio de estado para la otra parte de la cita: quien
 * hizo el cambio ya lo sabe, así que el aviso va a su contraparte (el tutor si
 * actuó el estudiante, y al revés).
 *
 * El texto depende del cambio y de quién lo hizo: aprobar y aceptar una
 * reprogramación llevan la cita a Aprobada, pero la primera avisa al estudiante
 * y la segunda al tutor.
 */
export function redactarAviso(cambio: CambioDeEstadoDeCita, cita: CitaConRelaciones): NuevaNotificacion {
  const actuoElEstudiante = cambio.actorId === cita.estudiante.id;
  const destinatarioId = actuoElEstudiante ? cita.franja.tutor.id : cita.estudiante.id;
  const contraparte = actuoElEstudiante ? cita.estudiante.nombre : cita.franja.tutor.nombre;
  const cuando = formatoDeFranja.format(cita.franja.fechaInicio);
  const sobre = `${cita.franja.materia.nombre}, ${cuando}`;

  const aviso = (titulo: string, texto: string): NuevaNotificacion => ({ usuarioId: destinatarioId, citaId: cita.id, titulo, texto: comoFrase(texto) });

  if (cambio.estadoAnterior === null) {
    return aviso("Nueva solicitud de tutoría", `${contraparte} reservó ${sobre}`);
  }

  switch (cambio.estadoNuevo) {
    case "APROBADA":
      return actuoElEstudiante
        ? aviso("Reprogramación aceptada", `${contraparte} aceptó el nuevo horario: ${sobre}`)
        : aviso("Tu tutoría fue aprobada", `${contraparte} aprobó ${sobre}`);
    case "RECHAZADA":
      return aviso("Tu solicitud fue rechazada", `${contraparte} rechazó ${sobre}. Motivo: ${cita.motivoRechazo ?? cambio.detalle}`);
    case "CANCELADA":
      return aviso(
        cambio.detalle.includes("Propuesta") ? "Reprogramación rechazada" : "Tutoría cancelada",
        `${contraparte} canceló la tutoría de ${cita.franja.materia.nombre}`,
      );
    case "FINALIZADA":
      return aviso("Tutoría finalizada", `${contraparte} marcó como finalizada la tutoría de ${sobre}`);
    case "PENDIENTE":
      return aviso("Propuesta de reprogramación", `${contraparte} propone mover la tutoría de ${cita.franja.materia.nombre} a: ${cuando}. Respóndele desde Mis tutorías`);
  }
}

/**
 * F-07 (SWR-15): cada cambio de estado de una cita genera un aviso para la otra
 * parte. Corre dentro de la transacción del cambio: si no se puede guardar el
 * aviso, el cambio tampoco se confirma.
 */
export const notificarCambioDeCita: SuscriptorDeCambios = async (cambio, repos) => {
  const cita = await repos.citas.cargar(cambio.citaId);
  await repos.notificaciones.crear(redactarAviso(cambio, cita));
};
