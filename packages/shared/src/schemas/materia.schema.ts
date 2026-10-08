import { z } from "zod";

export const materiaSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
});
export type Materia = z.infer<typeof materiaSchema>;

/** SWR-20: un tutor asocia una o mas materias a su perfil. */
export const asociarMateriasSchema = z.object({
  materiaIds: z
    .array(z.string().uuid("Alguna de las materias seleccionadas no es válida."))
    .min(1, "Selecciona al menos una materia."),
});
export type AsociarMateriasInput = z.infer<typeof asociarMateriasSchema>;
