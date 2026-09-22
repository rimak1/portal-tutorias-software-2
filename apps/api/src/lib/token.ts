import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Env } from "../config/env.js";

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

export function signSessionToken(env: Env, usuarioId: string): string {
  return jwt.sign({ sub: usuarioId } satisfies SessionTokenPayload, env.SESSION_SECRET, {
    expiresIn: `${env.SESSION_TTL_HORAS}h`,
  });
}

export function verifySessionToken(env: Env, token: string): SessionTokenPayload | null {
  try {
    return jwt.verify(token, env.SESSION_SECRET) as SessionTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Enlace de un solo uso para restablecer contrasena (RF-003). No requiere tabla
 * adicional: la huella de la contrasena vigente actua como marca de "ya usado"
 * o "vencido por cambio de contrasena".
 */
export function signResetToken(env: Env, usuarioId: string, passwordHash: string): string {
  const payload: ResetTokenPayload = { sub: usuarioId, pwfp: passwordFingerprint(passwordHash) };
  return jwt.sign(payload, env.RESET_TOKEN_SECRET, {
    expiresIn: `${env.RESET_TOKEN_TTL_MINUTOS}m`,
  });
}

export function verifyResetToken(env: Env, token: string): ResetTokenPayload | null {
  try {
    return jwt.verify(token, env.RESET_TOKEN_SECRET) as ResetTokenPayload;
  } catch {
    return null;
  }
}
