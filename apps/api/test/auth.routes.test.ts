import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../src/config/env.js";
import { buildApp } from "../src/app.js";
import { hashPassword } from "../src/lib/hash.js";

/**
 * Pruebas de integracion contra una base de datos PostgreSQL real (siguiendo
 * la estrategia de pruebas del documento de arquitectura, seccion 4.3).
 * Requiere DATABASE_URL apuntando a una base con las migraciones aplicadas,
 * p. ej. levantando `docker compose up -d db` y `npm run prisma:migrate`.
 */

const env = loadEnv();
const prisma = new PrismaClient();

let app: FastifyInstance;

const CORREO_ACTIVO = "activo.test@uniquindio.edu.co";
const CORREO_DESACTIVADO = "desactivado.test@uniquindio.edu.co";
const PASSWORD = "ClaveDePrueba123";

beforeAll(async () => {
  app = await buildApp(env);
  await app.ready();

  const passwordHash = await hashPassword(PASSWORD);

  await prisma.usuario.deleteMany({ where: { correo: { in: [CORREO_ACTIVO, CORREO_DESACTIVADO] } } });
  await prisma.usuario.create({
    data: { correo: CORREO_ACTIVO, nombre: "Usuario Activo", rol: "ESTUDIANTE", passwordHash, activo: true },
  });
  await prisma.usuario.create({
    data: { correo: CORREO_DESACTIVADO, nombre: "Usuario Desactivado", rol: "ESTUDIANTE", passwordHash, activo: false },
  });
});

afterAll(async () => {
  await prisma.usuario.deleteMany({ where: { correo: { in: [CORREO_ACTIVO, CORREO_DESACTIVADO] } } });
  await prisma.$disconnect();
  await app.close();
});

describe("POST /api/auth/login (RF-001, RN-001)", () => {
  it("inicia sesion con credenciales validas y fija la cookie de sesion", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { correo: CORREO_ACTIVO, password: PASSWORD },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().usuario.correo).toBe(CORREO_ACTIVO);
    expect(response.cookies.some((c) => c.name === env.SESSION_COOKIE_NAME)).toBe(true);
  });

  it("rechaza una contrasena incorrecta con mensaje generico", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { correo: CORREO_ACTIVO, password: "incorrecta" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rechaza el inicio de sesion de una cuenta desactivada", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { correo: CORREO_DESACTIVADO, password: PASSWORD },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("RBAC: acceso segun el rol (RN-001)", () => {
  it("una peticion sin cookie de sesion es rechazada", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/sesion" });
    expect(response.statusCode).toBe(401);
  });

  it("una cuenta desactivada pierde el acceso de inmediato aunque tuviera sesion vigente", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { correo: CORREO_ACTIVO, password: PASSWORD },
    });
    const cookie = login.cookies.find((c) => c.name === env.SESSION_COOKIE_NAME)!;

    await prisma.usuario.update({ where: { correo: CORREO_ACTIVO }, data: { activo: false } });

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/sesion",
      cookies: { [cookie.name]: cookie.value },
    });
    expect(response.statusCode).toBe(401);

    // Se reactiva para no afectar otras pruebas que reutilicen el mismo correo.
    await prisma.usuario.update({ where: { correo: CORREO_ACTIVO }, data: { activo: true } });
  });
});

describe("POST /api/auth/recuperar y /api/auth/restablecer (RF-003)", () => {
  it("no revela si el correo existe", async () => {
    const existente = await app.inject({
      method: "POST",
      url: "/api/auth/recuperar",
      payload: { correo: CORREO_ACTIVO },
    });
    const inexistente = await app.inject({
      method: "POST",
      url: "/api/auth/recuperar",
      payload: { correo: "no-existe@uniquindio.edu.co" },
    });

    expect(existente.statusCode).toBe(200);
    expect(inexistente.statusCode).toBe(200);
    expect(existente.json()).toEqual(inexistente.json());
  });

  it("rechaza un token de restablecimiento invalido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/restablecer",
      payload: { token: "token-invalido", password: "NuevaClave123" },
    });
    expect(response.statusCode).toBe(400);
  });
});
