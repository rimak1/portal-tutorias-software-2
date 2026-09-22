import { describe, expect, it } from "vitest";
import type { Env } from "../src/config/env.js";
import {
  passwordFingerprint,
  signResetToken,
  signSessionToken,
  verifyResetToken,
  verifySessionToken,
} from "../src/lib/token.js";

const env: Env = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  PORT: 3000,
  HOST: "0.0.0.0",
  NODE_ENV: "test",
  SESSION_SECRET: "secreto-de-sesion-para-pruebas-1234",
  SESSION_COOKIE_NAME: "portal_session",
  SESSION_TTL_HORAS: 12,
  RESET_TOKEN_SECRET: "secreto-de-restablecimiento-pruebas-5678",
  RESET_TOKEN_TTL_MINUTOS: 30,
  SMTP_FROM: "Portal <no-responder@example.edu.co>",
  EMAIL_ADAPTER: "mock",
  WEB_APP_URL: "http://localhost:5173",
};

describe("sesion (cookie firmada)", () => {
  it("emite y valida un token de sesion para el usuario correcto", () => {
    const token = signSessionToken(env, "usuario-123");
    const payload = verifySessionToken(env, token);
    expect(payload?.sub).toBe("usuario-123");
  });

  it("rechaza un token manipulado", () => {
    const token = signSessionToken(env, "usuario-123");
    const manipulado = token.slice(0, -2) + "xx";
    expect(verifySessionToken(env, manipulado)).toBeNull();
  });

  it("rechaza un token firmado con otro secreto", () => {
    const otroEnv = { ...env, SESSION_SECRET: "otro-secreto-completamente-distinto" };
    const token = signSessionToken(otroEnv, "usuario-123");
    expect(verifySessionToken(env, token)).toBeNull();
  });
});

describe("token de restablecimiento (RF-003, un solo uso)", () => {
  it("es valido mientras la contrasena no ha cambiado", () => {
    const token = signResetToken(env, "usuario-123", "hash-actual");
    const payload = verifyResetToken(env, token);
    expect(payload?.sub).toBe("usuario-123");
    expect(payload?.pwfp).toBe(passwordFingerprint("hash-actual"));
  });

  it("la huella cambia si la contrasena cambia, invalidando el enlace anterior", () => {
    const token = signResetToken(env, "usuario-123", "hash-viejo");
    const payload = verifyResetToken(env, token);
    const huellaNueva = passwordFingerprint("hash-nuevo-tras-cambio");
    expect(payload?.pwfp).not.toBe(huellaNueva);
  });
});
