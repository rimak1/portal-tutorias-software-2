import { z } from "zod";

export const materiaSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
});
export type Materia = z.infer<typeof materiaSchema>;

/** SWR-20: un tutor asocia una o más materias a su perfil. */
export const asociarMateriasSchema = z.object({
  materiaIds: z
    .array(z.string().uuid("Alguna de las materias seleccionadas no es válida."))
    .min(1, "Selecciona al menos una materia.")
    // Tope generoso: el catálogo es pequeño, y una lista enorme solo serviría para gastar memoria al validarla.
    .max(200, "Seleccionaste demasiadas materias."),
});
export type AsociarMateriasInput = z.infer<typeof asociarMateriasSchema>;
