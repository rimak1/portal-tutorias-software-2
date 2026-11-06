import { z } from "zod";
import { ESTADOS_CITA, citaSchema } from "./cita.schema.js";

/** Filtros del histórico de tutorías (F-09, SWR-17); llegan como texto en la URL y todos son opcionales. */
export const filtroDeHistoricoSchema = z
  .object({
    /** Inicio del rango: incluye las tutorías cuya franja comienza en este instante o después. */
    desde: z.string().datetime({ offset: true, message: "La fecha inicial no es válida." }).optional(),
    /** Fin del rango: solo las tutorías cuya franja comienza antes de este instante. */
    hasta: z.string().datetime({ offset: true, message: "La fecha final no es válida." }).optional(),
    tutorId: z.string().uuid("El tutor seleccionado no es válido.").optional(),
    materiaId: z.string().uuid("La materia seleccionada no es válida.").optional(),
    estado: z.enum(ESTADOS_CITA, { errorMap: () => ({ message: "El estado seleccionado no es válido." }) }).optional(),
  })
  .refine(
    ({ desde, hasta }) => !desde || !hasta || Date.parse(desde) < Date.parse(hasta),
    "La fecha inicial debe ser anterior a la final.",
  );
export type FiltroDeHistorico = z.infer<typeof filtroDeHistoricoSchema>;

export const TAMANO_DE_PAGINA_POR_DEFECTO = 20;
export const TAMANO_DE_PAGINA_MAXIMO = 100;

export const paginaDeHistoricoSchema = z.object({
  pagina: z.coerce.number().int("La página no es válida.").min(1, "La página no es válida.").default(1),
  tamano: z.coerce
    .number()
    .int("El tamaño de página no es válido.")
    .min(1, "El tamaño de página no es válido.")
    .max(TAMANO_DE_PAGINA_MAXIMO, `El tamaño de página no puede superar ${TAMANO_DE_PAGINA_MAXIMO}.`)
    .default(TAMANO_DE_PAGINA_POR_DEFECTO),
});
export type PaginaDeHistorico = z.infer<typeof paginaDeHistoricoSchema>;

const conteoPorEstadoSchema = z.object(
  Object.fromEntries(ESTADOS_CITA.map((estado) => [estado, z.number().int().nonnegative()])) as Record<
    (typeof ESTADOS_CITA)[number],
    z.ZodNumber
  >,
);

/** Totales del conjunto completo que cumple los filtros, no solo de la página que se muestra. */
export const resumenDeHistoricoSchema = z.object({
  total: z.number().int().nonnegative(),
  porEstado: conteoPorEstadoSchema,
  /** Horas de tutoría efectivamente realizadas (citas Finalizadas), con un decimal. */
  horasFinalizadas: z.number().nonnegative(),
  porMateria: z.array(z.object({ materia: z.string(), total: z.number().int().positive() })),
  porTutor: z.array(
    z.object({
      tutor: z.object({ id: z.string().uuid(), nombre: z.string() }),
      total: z.number().int().positive(),
      finalizadas: z.number().int().nonnegative(),
    }),
  ),
});
export type ResumenDeHistorico = z.infer<typeof resumenDeHistoricoSchema>;

export const historicoSchema = z.object({
  citas: z.array(citaSchema),
  pagina: z.number().int().positive(),
  tamano: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  resumen: resumenDeHistoricoSchema,
  /** true si el filtro cubre más tutorías de las que el sistema calcula de una vez; conviene acotar el rango. */
  truncado: z.boolean(),
});
export type Historico = z.infer<typeof historicoSchema>;

/** Un cambio de estado de la cita, tomado de su bitácora (BR-04). */
export const eventoDeCitaSchema = z.object({
  estadoAnterior: z.enum(ESTADOS_CITA).nullable(),
  estadoNuevo: z.enum(ESTADOS_CITA),
  actor: z.object({ id: z.string().uuid(), nombre: z.string() }),
  detalle: z.string().nullable(),
  creadoEn: z.string(),
});
export type EventoDeCita = z.infer<typeof eventoDeCitaSchema>;

export const detalleDeHistoricoSchema = z.object({
  cita: citaSchema,
  eventos: z.array(eventoDeCitaSchema),
});
export type DetalleDeHistorico = z.infer<typeof detalleDeHistoricoSchema>;
