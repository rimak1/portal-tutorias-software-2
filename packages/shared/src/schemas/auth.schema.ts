import { z } from "zod";
import { ROLES } from "../types/roles.js";

export const loginSchema = z.object({
  correo: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const solicitarRecuperacionSchema = z.object({
  correo: z.string().email(),
});
export type SolicitarRecuperacionInput = z.infer<typeof solicitarRecuperacionSchema>;

export const restablecerPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});
export type RestablecerPasswordInput = z.infer<typeof restablecerPasswordSchema>;

export const usuarioSesionSchema = z.object({
  id: z.string().uuid(),
  correo: z.string().email(),
  nombre: z.string(),
  rol: z.enum(ROLES),
});
export type UsuarioSesion = z.infer<typeof usuarioSesionSchema>;
