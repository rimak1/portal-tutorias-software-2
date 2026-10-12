import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Env } from "../config/env.js";

/** Cada funcion declara solo la configuracion que lee (ISP), en vez de recibir todo el entorno. */
export type ConfigDeSesion = Pick<Env, "SESSION_SECRET" | "SESSION_TTL_HORAS">;
export type ConfigDeRestablecimiento = Pick<Env, "RESET_TOKEN_SECRET" | "RESET_TOKEN_TTL_MINUTOS">;

export interface SessionTokenPayload {
  sub: string;
}

export interface ResetTokenPayload {
  sub: string;
  /** Huella de la contrasena vigente al emitir el token: si la contrasena cambia, deja de coincidir. */
  pwfp: string;
}

export function passwordFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

export function signSessionToken(config: ConfigDeSesion, usuarioId: string): string {
  return jwt.sign({ sub: usuarioId } satisfies SessionTokenPayload, config.SESSION_SECRET, {
    expiresIn: `${config.SESSION_TTL_HORAS}h`,
  });
}

export function verifySessionToken(config: Pick<Env, "SESSION_SECRET">, token: string): SessionTokenPayload | null {
  try {
    return jwt.verify(token, config.SESSION_SECRET) as SessionTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Enlace de un solo uso para restablecer contrasena (RF-003). No requiere tabla
 * adicional: la huella de la contrasena vigente actua como marca de "ya usado"
 * o "vencido por cambio de contrasena".
 */
export function signResetToken(config: ConfigDeRestablecimiento, usuarioId: string, passwordHash: string): string {
  const payload: ResetTokenPayload = { sub: usuarioId, pwfp: passwordFingerprint(passwordHash) };
  return jwt.sign(payload, config.RESET_TOKEN_SECRET, {
    expiresIn: `${config.RESET_TOKEN_TTL_MINUTOS}m`,
  });
}

export function verifyResetToken(config: Pick<Env, "RESET_TOKEN_SECRET">, token: string): ResetTokenPayload | null {
  try {
    return jwt.verify(token, config.RESET_TOKEN_SECRET) as ResetTokenPayload;
  } catch {
    return null;
  }
}
