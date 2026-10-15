import {
  passwordFingerprint,
  signResetToken,
  signSessionToken,
  verifyResetToken,
  verifySessionToken,
  type ConfigDeRestablecimiento,
  type ConfigDeSesion,
} from "../../lib/token.js";
import type { TokensDeRestablecimiento, TokensDeSesion } from "./auth.puertos.js";

/** Tokens de sesión firmados como JWT con `SESSION_SECRET`. */
export function crearTokensDeSesion(config: ConfigDeSesion): TokensDeSesion {
  return {
    emitir: (usuarioId) => signSessionToken(config, usuarioId),
    verificar: (token) => verifySessionToken(config, token)?.sub ?? null,
  };
}

/** Tokens de restablecimiento firmados como JWT con `RESET_TOKEN_SECRET`. */
export function crearTokensDeRestablecimiento(config: ConfigDeRestablecimiento): TokensDeRestablecimiento {
  return {
    emitir: (usuarioId, passwordHash) => signResetToken(config, usuarioId, passwordHash),
    verificar: (token) => {
      const payload = verifyResetToken(config, token);
      return payload ? { usuarioId: payload.sub, huellaDePassword: payload.pwfp } : null;
    },
    huellaDe: passwordFingerprint,
  };
}
