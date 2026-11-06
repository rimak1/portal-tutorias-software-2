import { z } from "zod";
import { ROLES } from "../types/roles.js";

/** F-08 (SWR-16): cuenta de usuario tal como la ve quien la administra (nunca incluye la contraseña). */
export const cuentaSchema = z.object({
  id: z.string().uuid(),
  correo: z.string().email(),
  nombre: z.string(),
  rol: z.enum(ROLES),
  activo: z.boolean(),
  creadoEn: z.string(),
});
export type Cuenta = z.infer<typeof cuentaSchema>;

const nombreSchema = z
  .string()
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres.")
  .max(100, "El nombre no puede superar los 100 caracteres.");

const passwordInicialSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .max(128, "La contraseña no puede superar los 128 caracteres.");

/** El correo se guarda en minúsculas para que dos cuentas no difieran solo por mayúsculas. */
export const crearCuentaSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Ingresa un correo válido."),
  nombre: nombreSchema,
  rol: z.enum(ROLES, { errorMap: () => ({ message: "Selecciona un rol válido." }) }),
  password: passwordInicialSchema,
});
export type CrearCuentaInput = z.infer<typeof crearCuentaSchema>;

/**
 * Cambios que admite una cuenta existente. El rol no se modifica: una cuenta con
 * franjas o citas quedaría con datos de un rol que ya no tiene; en ese caso se
 * desactiva y se crea otra.
 */
export const actualizarCuentaSchema = z
  .object({
    nombre: nombreSchema.optional(),
    activo: z.boolean({ invalid_type_error: "El estado de la cuenta no es válido." }).optional(),
    password: passwordInicialSchema.optional(),
  })
  .strict("No se puede modificar ese dato de la cuenta.")
  .refine((valor) => Object.values(valor).some((campo) => campo !== undefined), "No hay cambios para guardar.");
export type ActualizarCuentaInput = z.infer<typeof actualizarCuentaSchema>;

/** Filtros del listado de cuentas (llegan como texto en la URL). */
export const filtroDeCuentasSchema = z.object({
  rol: z.enum(ROLES).optional(),
  activo: z
    .enum(["true", "false"])
    .transform((valor) => valor === "true")
    .optional(),
  q: z.string().trim().max(100).optional(),
});
export type FiltroDeCuentas = z.infer<typeof filtroDeCuentasSchema>;

export const listaDeCuentasSchema = z.object({ cuentas: z.array(cuentaSchema) });
export type ListaDeCuentas = z.infer<typeof listaDeCuentasSchema>;
