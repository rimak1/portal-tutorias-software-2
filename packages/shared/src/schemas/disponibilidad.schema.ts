import { z } from "zod";

export const disponibilidadSchema = z.object({
  id: z.string().uuid(),
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
