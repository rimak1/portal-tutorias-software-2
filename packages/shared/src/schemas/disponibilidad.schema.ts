import { z } from "zod";

export const ESTADOS_FRANJA = ["LIBRE", "RESERVADA"] as const;
export type EstadoFranja = (typeof ESTADOS_FRANJA)[number];

export const disponibilidadSchema = z.object({
  id: z.string().uuid(),
  materiaId: z.string().uuid(),
  materia: z.string(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  tutor: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
  }),
});
export type Disponibilidad = z.infer<typeof disponibilidadSchema>;

export const listaDisponibilidadSchema = z.object({
  disponibilidades: z.array(disponibilidadSchema),
});
export type ListaDisponibilidad = z.infer<typeof listaDisponibilidadSchema>;

/** Franja tal como la ve su propio tutor (incluye el estado de reserva). */
export const franjaPropiaSchema = disponibilidadSchema.extend({
  estado: z.enum(ESTADOS_FRANJA),
});
export type FranjaPropia = z.infer<typeof franjaPropiaSchema>;

const fechaIso = z
  .string()
  .refine((valor) => !Number.isNaN(Date.parse(valor)), "Fecha u hora inválida.");

/** SWR-03: fecha, hora de inicio y hora de fin (inicio y fin como instantes ISO). */
export const crearFranjaSchema = z.object({
  materiaId: z.string().uuid("Selecciona una materia válida."),
  fechaInicio: fechaIso,
  fechaFin: fechaIso,
});
export type CrearFranjaInput = z.infer<typeof crearFranjaSchema>;

export const actualizarFranjaSchema = z
  .object({
    materiaId: z.string().uuid("Selecciona una materia válida.").optional(),
    fechaInicio: fechaIso.optional(),
    fechaFin: fechaIso.optional(),
  })
  .refine((valor) => Object.keys(valor).length > 0, "No hay cambios para guardar.");
export type ActualizarFranjaInput = z.infer<typeof actualizarFranjaSchema>;
