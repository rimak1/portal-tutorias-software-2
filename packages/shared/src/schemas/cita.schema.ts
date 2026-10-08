import { z } from "zod";

export const ESTADOS_CITA = ["PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA", "FINALIZADA"] as const;
export type EstadoCita = (typeof ESTADOS_CITA)[number];

export const ESTADOS_PROPUESTA = ["PENDIENTE", "ACEPTADA", "RECHAZADA"] as const;
export type EstadoPropuesta = (typeof ESTADOS_PROPUESTA)[number];

const personaSchema = z.object({ id: z.string().uuid(), nombre: z.string() });

const franjaCitaSchema = z.object({
  id: z.string().uuid(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
});

export const citaSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(ESTADOS_CITA),
  motivoRechazo: z.string().nullable(),
  materia: z.string(),
  tutor: personaSchema,
  estudiante: personaSchema,
  /** Franja que la cita ocupa hoy; con una propuesta pendiente es la franja nueva propuesta. */
  franja: franjaCitaSchema,
  /** Propuesta de reprogramacion esperando respuesta del estudiante; conserva el horario original. */
  propuestaPendiente: z.object({ franjaOriginal: franjaCitaSchema }).nullable(),
  creadoEn: z.string(),
  fechaFinalizacion: z.string().nullable(),
});
export type Cita = z.infer<typeof citaSchema>;

/** SWR-08 / SWR-25: la reserva es una unica operacion sobre una franja. */
export const reservarCitaSchema = z.object({
  disponibilidadId: z.string().uuid("Selecciona una franja válida."),
});
export type ReservarCitaInput = z.infer<typeof reservarCitaSchema>;

/** SWR-12: el motivo de rechazo es obligatorio. */
export const rechazarCitaSchema = z.object({
  motivo: z.string().trim().min(1, "Indica el motivo del rechazo."),
});
export type RechazarCitaInput = z.infer<typeof rechazarCitaSchema>;

/** SWR-11: el tutor propone otra franja libre propia. */
export const reprogramarCitaSchema = z.object({
  disponibilidadId: z.string().uuid("Selecciona una franja válida."),
});
export type ReprogramarCitaInput = z.infer<typeof reprogramarCitaSchema>;
