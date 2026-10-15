import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { EmailSender } from "../src/modules/email/email-sender.js";
import { crearUsuario, env, limpiar, prisma } from "./helpers.js";

const P = "cor";

const proveedorCaido: EmailSender = {
  async enviarRecuperacionPassword() {
    throw new Error("SMTP no disponible");
  },
};

let app: FastifyInstance;
let correoRegistrado: string;

beforeAll(async () => {
  app = await buildApp(env, { emailSender: proveedorCaido });
  await app.ready();
  await limpiar(P);
  correoRegistrado = (await crearUsuario(P, "Registrado", "ESTUDIANTE")).correo;
});

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
  await app.close();
});

const recuperar = (correo: string) => app.inject({ method: "POST", url: "/api/auth/recuperar", payload: { correo } });

describe("SWR-18 con el proveedor de correo caído", () => {
  it("la respuesta es identica para un correo registrado y para uno inexistente: un fallo del SMTP no revela que la cuenta existe", async () => {
    const registrado = await recuperar(correoRegistrado);
    const inexistente = await recuperar("nadie@test.uniquindio.edu.co");

    expect(registrado.statusCode).toBe(200);
    expect(inexistente.statusCode).toBe(200);
    expect(registrado.json()).toEqual(inexistente.json());
  });
});
