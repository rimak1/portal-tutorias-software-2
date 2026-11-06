import { z } from "zod";

/** F-07 (SWR-15): aviso dentro de la plataforma sobre un cambio en una cita del usuario. */
export const notificacionSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string(),
  texto: z.string(),
  citaId: z.string().uuid().nullable(),
  leida: z.boolean(),
  creadoEn: z.string(),
});
export type Notificacion = z.infer<typeof notificacionSchema>;

export const listaDeNotificacionesSchema = z.object({
  notificaciones: z.array(notificacionSchema),
  /** Total de avisos sin leer; puede superar los que trae la lista. */
  noLeidas: z.number().int().nonnegative(),
});
export type ListaDeNotificaciones = z.infer<typeof listaDeNotificacionesSchema>;
