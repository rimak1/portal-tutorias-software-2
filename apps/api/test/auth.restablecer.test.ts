import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { RolUsuario } from "@prisma/client";
import { buildApp } from "../src/app.js";
import type { EmailSender } from "../src/modules/email/email-sender.js";
import { PASSWORD, crearUsuario, env, iniciarSesion, limpiar, prisma } from "./helpers.js";

const P = "aut";
const NUEVA_PASSWORD = "OtraClaveNueva456";

const correosEnviados: Array<{ destinatario: string; enlace: string }> = [];
const emailSenderDePrueba: EmailSender = {
  async enviarRecuperacionPassword(destinatario, enlace) {
    correosEnviados.push({ destinatario, enlace });
  },
};

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp(env, { emailSender: emailSenderDePrueba });
  await app.ready();
  await limpiar(P);
});

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
  await app.close();
});

const login = (correo: string, password: string) =>
  app.inject({ method: "POST", url: "/api/auth/login", payload: { correo, password } });

const tokenDelEnlace = (enlace: string) => new URL(enlace).searchParams.get("token")!;

describe("SWR-01 y SWR-02: inicio de sesion diferenciado segun el rol", () => {
  const roles: RolUsuario[] = ["ESTUDIANTE", "TUTOR", "ADMINISTRADOR", "COORDINADOR"];

  it.each(roles)("el usuario con rol %s inicia sesion y el sistema identifica su rol", async (rol) => {
    const usuario = await crearUsuario(P, `Rol ${rol}`, rol);

    const respuesta = await login(usuario.correo, PASSWORD);

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().usuario.rol).toBe(rol);

    const sesion = await app.inject({ method: "GET", url: "/api/auth/sesion", cookies: await iniciarSesion(app, usuario.correo) });
    expect(sesion.json().usuario.rol).toBe(rol);
  });
});

describe("SWR-18: restablecer la contrasena mediante el correo registrado", () => {
  it("envia el enlace de restablecimiento al correo registrado", async () => {
    const usuario = await crearUsuario(P, "Con Correo", "ESTUDIANTE");
    correosEnviados.length = 0;

    const respuesta = await app.inject({ method: "POST", url: "/api/auth/recuperar", payload: { correo: usuario.correo } });

    expect(respuesta.statusCode).toBe(200);
    expect(correosEnviados).toHaveLength(1);
    expect(correosEnviados[0].destinatario).toBe(usuario.correo);
    expect(correosEnviados[0].enlace).toContain("/restablecer-password?token=");
  });

  it("no envia nada a un correo no registrado ni a una cuenta desactivada, y responde igual", async () => {
    const desactivada = await crearUsuario(P, "Desactivada", "ESTUDIANTE", false);
    correosEnviados.length = 0;

    const inexistente = await app.inject({ method: "POST", url: "/api/auth/recuperar", payload: { correo: "nadie@test.uniquindio.edu.co" } });
    const inactiva = await app.inject({ method: "POST", url: "/api/auth/recuperar", payload: { correo: desactivada.correo } });

    expect(inexistente.json()).toEqual(inactiva.json());
    expect(correosEnviados).toHaveLength(0);
  });

  it("con el enlace recibido el usuario define una nueva contrasena y la anterior deja de servir", async () => {
    const usuario = await crearUsuario(P, "Flujo Completo", "TUTOR");
    correosEnviados.length = 0;
    await app.inject({ method: "POST", url: "/api/auth/recuperar", payload: { correo: usuario.correo } });
    const token = tokenDelEnlace(correosEnviados[0].enlace);

    const cambio = await app.inject({ method: "POST", url: "/api/auth/restablecer", payload: { token, password: NUEVA_PASSWORD } });

    expect(cambio.statusCode).toBe(200);
    expect((await login(usuario.correo, NUEVA_PASSWORD)).statusCode).toBe(200);
    expect((await login(usuario.correo, PASSWORD)).statusCode).toBe(401);
  });

  it("el enlace es de un solo uso", async () => {
    const usuario = await crearUsuario(P, "Un Solo Uso", "TUTOR");
    correosEnviados.length = 0;
    await app.inject({ method: "POST", url: "/api/auth/recuperar", payload: { correo: usuario.correo } });
    const token = tokenDelEnlace(correosEnviados[0].enlace);

    await app.inject({ method: "POST", url: "/api/auth/restablecer", payload: { token, password: NUEVA_PASSWORD } });
    const segundoUso = await app.inject({ method: "POST", url: "/api/auth/restablecer", payload: { token, password: "TercerClave789" } });

    expect(segundoUso.statusCode).toBe(400);
    expect((await login(usuario.correo, NUEVA_PASSWORD)).statusCode).toBe(200);
  });

  it("rechaza una contrasena nueva demasiado corta", async () => {
    const usuario = await crearUsuario(P, "Clave Corta", "TUTOR");
    correosEnviados.length = 0;
    await app.inject({ method: "POST", url: "/api/auth/recuperar", payload: { correo: usuario.correo } });
    const token = tokenDelEnlace(correosEnviados[0].enlace);

    const respuesta = await app.inject({ method: "POST", url: "/api/auth/restablecer", payload: { token, password: "corta" } });

    expect(respuesta.statusCode).toBe(400);
    expect((await login(usuario.correo, PASSWORD)).statusCode).toBe(200);
  });
});

describe("SWR-23: las contrasenas se almacenan cifradas, nunca en texto plano", () => {
  it("la base de datos guarda un hash argon2id que no contiene la contrasena", async () => {
    const usuario = await crearUsuario(P, "Cifrado", "ESTUDIANTE");

    const enBase = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });

    expect(enBase.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(enBase.passwordHash).not.toContain(PASSWORD);
  });
});
