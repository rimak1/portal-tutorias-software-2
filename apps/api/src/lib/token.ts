import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Env } from "../config/env.js";

export type ConfigDeSesion = Pick<Env, "SESSION_SECRET" | "SESSION_TTL_HORAS">;
export type ConfigDeRestablecimiento = Pick<Env, "RESET_TOKEN_SECRET" | "RESET_TOKEN_TTL_MINUTOS">;

export interface SessionTokenPayload {
  sub: string;
}

export interface ResetTokenPayload {
  sub: string;
  /** Huella de la contraseña vigente al emitir el token: si la contraseña cambia, deja de coincidir. */
  pwfp: string;
}

/** Huella corta y no reversible de un hash de contraseña. */
export function passwordFingerprint(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

/** Firma el token de sesión; vence a las `SESSION_TTL_HORAS` horas. */
export function signSessionToken(config: ConfigDeSesion, usuarioId: string): string {
  return jwt.sign({ sub: usuarioId } satisfies SessionTokenPayload, config.SESSION_SECRET, {
    expiresIn: `${config.SESSION_TTL_HORAS}h`,
  });
}

/** Contenido del token de sesión, o null si la firma no es válida o el token venció. */
export function verifySessionToken(config: Pick<Env, "SESSION_SECRET">, token: string): SessionTokenPayload | null {
  try {
    return jwt.verify(token, config.SESSION_SECRET) as SessionTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Firma el token del enlace para restablecer la contraseña (RF-003); vence a
 * los `RESET_TOKEN_TTL_MINUTOS` minutos. No necesita una tabla: la huella de la
 * contraseña vigente lo invalida en cuanto la contraseña cambia.
 */
export function signResetToken(config: ConfigDeRestablecimiento, usuarioId: string, passwordHash: string): string {
  const payload: ResetTokenPayload = { sub: usuarioId, pwfp: passwordFingerprint(passwordHash) };
  return jwt.sign(payload, config.RESET_TOKEN_SECRET, {
    expiresIn: `${config.RESET_TOKEN_TTL_MINUTOS}m`,
  });
}

/** Contenido del token de restablecimiento, o null si la firma no es válida o el token venció. */
export function verifyResetToken(config: Pick<Env, "RESET_TOKEN_SECRET">, token: string): ResetTokenPayload | null {
  try {
    return jwt.verify(token, config.RESET_TOKEN_SECRET) as ResetTokenPayload;
  } catch {
    return null;
  }
}
