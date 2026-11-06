import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { EmailSender } from "../src/modules/email/email-sender.js";
import { PASSWORD, crearUsuario, env, limpiar, prisma } from "./helpers.js";
import { RelojFijo } from "./fakes.js";

/**
 * Límite de intentos y cabeceras de seguridad. Cada prueba construye su propia
 * aplicación con límites pequeños y un reloj fijo, para no depender del tiempo
 * real ni afectar a los demás archivos.
 */

const P = "seg";
const apps: FastifyInstance[] = [];
let correo: string;

class CorreoQueCuenta implements EmailSender {
  enviados: string[] = [];
  async enviarRecuperacionPassword(destinatario: string) {
    this.enviados.push(destinatario);
  }
}

beforeAll(async () => {
  await limpiar(P);
  correo = (await crearUsuario(P, "Cuenta", "ESTUDIANTE")).correo;
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
});

async function crearApp(opciones: Parameters<typeof buildApp>[1] = {}) {
  const app = await buildApp(env, opciones);
  await app.ready();
  apps.push(app);
  return app;
}

const login = (app: FastifyInstance, correoDeCuenta: string, password: string, ip?: string) =>
  app.inject({ method: "POST", url: "/api/auth/login", payload: { correo: correoDeCuenta, password }, remoteAddress: ip });

describe("límite de intentos fallidos de inicio de sesión", () => {
  it("tras agotar los intentos fallidos contra una cuenta, responde 429 con Retry-After, incluso con la contraseña correcta", async () => {
    const reloj = new RelojFijo(new Date("2027-01-01T10:00:00Z"));
    const app = await crearApp({ reloj, limites: { fallosDeLoginPorCuenta: 3 } });

    for (let i = 0; i < 3; i++) {
      expect((await login(app, correo, "incorrecta")).statusCode).toBe(401);
    }
    const bloqueado = await login(app, correo, PASSWORD);

    expect(bloqueado.statusCode).toBe(429);
    expect(bloqueado.json().message).toContain("Demasiados intentos");
    expect(Number(bloqueado.headers["retry-after"])).toBeGreaterThan(0);
    expect(bloqueado.cookies).toEqual([]);
  });

  it("vuelve a permitir el acceso cuando pasa la ventana", async () => {
    const reloj = new RelojFijo(new Date("2027-01-01T10:00:00Z"));
    const app = await crearApp({ reloj, limites: { fallosDeLoginPorCuenta: 2, ventanaMs: 10 * 60_000 } });
    await login(app, correo, "incorrecta");
    await login(app, correo, "incorrecta");
    expect((await login(app, correo, PASSWORD)).statusCode).toBe(429);

    reloj.avanzarHoras(11 / 60);

    expect((await login(app, correo, PASSWORD)).statusCode).toBe(200);
  });

  it("un inicio de sesión correcto reinicia la cuenta de fallos de esa cuenta", async () => {
    const app = await crearApp({ limites: { fallosDeLoginPorCuenta: 3 } });

    for (let ronda = 0; ronda < 3; ronda++) {
      await login(app, correo, "incorrecta");
      await login(app, correo, "incorrecta");
      expect((await login(app, correo, PASSWORD)).statusCode, `ronda ${ronda}`).toBe(200);
    }
  });

  it("los inicios de sesión correctos no gastan el límite, por muchos que sean", async () => {
    const app = await crearApp({ limites: { fallosDeLoginPorIp: 2, fallosDeLoginPorCuenta: 2 } });

    for (let i = 0; i < 6; i++) {
      expect((await login(app, correo, PASSWORD)).statusCode).toBe(200);
    }
  });

  it("el límite por cuenta es por dirección IP: otra IP no queda bloqueada por los fallos de la primera", async () => {
    const app = await crearApp({ limites: { fallosDeLoginPorCuenta: 2 } });
    await login(app, correo, "incorrecta", "10.0.0.1");
    await login(app, correo, "incorrecta", "10.0.0.1");

    expect((await login(app, correo, PASSWORD, "10.0.0.1")).statusCode).toBe(429);
    expect((await login(app, correo, PASSWORD, "10.0.0.2")).statusCode).toBe(200);
  });

  it("el límite por IP bloquea a quien prueba muchos correos distintos", async () => {
    const app = await crearApp({ limites: { fallosDeLoginPorIp: 3, fallosDeLoginPorCuenta: 100 } });

    for (let i = 0; i < 3; i++) {
      expect((await login(app, `nadie${i}@uq.edu.co`, "x", "10.0.0.9")).statusCode).toBe(401);
    }

    expect((await login(app, "otro@uq.edu.co", "x", "10.0.0.9")).statusCode).toBe(429);
    expect((await login(app, correo, PASSWORD, "10.0.0.10")).statusCode).toBe(200);
  });

  it("no distingue mayúsculas del correo al contar los fallos", async () => {
    const app = await crearApp({ limites: { fallosDeLoginPorCuenta: 2 } });
    await login(app, correo.toUpperCase(), "incorrecta");
    await login(app, correo, "incorrecta");

    expect((await login(app, correo, PASSWORD)).statusCode).toBe(429);
  });
});

describe("límite de solicitudes de recuperación de contraseña", () => {
  const recuperar = (app: FastifyInstance, correoDeCuenta: string, ip?: string) =>
    app.inject({ method: "POST", url: "/api/auth/recuperar", payload: { correo: correoDeCuenta }, remoteAddress: ip });

  it("pasado el límite de un correo no se envían más correos, pero la respuesta no cambia", async () => {
    const emailSender = new CorreoQueCuenta();
    const app = await crearApp({ emailSender, limites: { recuperacionesPorCuenta: 2 } });

    const respuestas = [];
    for (let i = 0; i < 5; i++) respuestas.push(await recuperar(app, correo));

    expect(respuestas.map((r) => r.statusCode)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(respuestas.map((r) => r.body)).size).toBe(1);
    expect(emailSender.enviados).toEqual([correo, correo]);
  });

  it("el límite por IP responde 429 con Retry-After", async () => {
    const app = await crearApp({ emailSender: new CorreoQueCuenta(), limites: { recuperacionesPorIp: 2, recuperacionesPorCuenta: 100 } });

    expect((await recuperar(app, "a@uq.edu.co", "10.1.1.1")).statusCode).toBe(200);
    expect((await recuperar(app, "b@uq.edu.co", "10.1.1.1")).statusCode).toBe(200);
    const bloqueada = await recuperar(app, "c@uq.edu.co", "10.1.1.1");

    expect(bloqueada.statusCode).toBe(429);
    expect(Number(bloqueada.headers["retry-after"])).toBeGreaterThan(0);
    expect((await recuperar(app, "c@uq.edu.co", "10.1.1.2")).statusCode).toBe(200);
  });
});

describe("cabeceras de seguridad de la API", () => {
  it("toda respuesta lleva las cabeceras de protección y no se guarda en caché", async () => {
    const app = await crearApp();

    for (const respuesta of [await app.inject({ method: "GET", url: "/api/salud" }), await login(app, correo, "incorrecta")]) {
      expect(respuesta.headers["x-content-type-options"]).toBe("nosniff");
      expect(respuesta.headers["x-frame-options"]).toBe("DENY");
      expect(respuesta.headers["referrer-policy"]).toBe("no-referrer");
      expect(respuesta.headers["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
      expect(respuesta.headers["cache-control"]).toBe("no-store");
    }
  });

  it("HSTS solo se envía en producción", async () => {
    const enPrueba = await crearApp();
    expect((await enPrueba.inject({ method: "GET", url: "/api/salud" })).headers["strict-transport-security"]).toBeUndefined();

    const enProduccion = await buildApp({ ...env, NODE_ENV: "production" });
    await enProduccion.ready();
    apps.push(enProduccion);
    expect((await enProduccion.inject({ method: "GET", url: "/api/salud" })).headers["strict-transport-security"]).toBe("max-age=15552000; includeSubDomains");
  });

  it("en producción la IP del cliente es la que añadió el proxy, no la que el cliente declaró", async () => {
    const app = await buildApp({ ...env, NODE_ENV: "production" }, { limites: { fallosDeLoginPorCuenta: 2 } });
    await app.ready();
    apps.push(app);
    const desdeProxy = (xff: string, password: string) =>
      app.inject({
        method: "POST",
        url: "/api/auth/login",
        remoteAddress: "172.18.0.5",
        headers: { "x-forwarded-for": xff },
        payload: { correo, password },
      });

    // Nginx añade la IP real al final de lo que el cliente haya enviado; cambiar el principio no sirve para evadir el límite.
    await desdeProxy("1.1.1.1, 203.0.113.7", "incorrecta");
    await desdeProxy("2.2.2.2, 203.0.113.7", "incorrecta");

    expect((await desdeProxy("3.3.3.3, 203.0.113.7", PASSWORD)).statusCode).toBe(429);
    expect((await desdeProxy("3.3.3.3, 198.51.100.9", PASSWORD)).statusCode).toBe(200);
  });
});
