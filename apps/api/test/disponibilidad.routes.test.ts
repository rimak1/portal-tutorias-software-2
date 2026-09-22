import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "../src/config/env.js";
import { buildApp } from "../src/app.js";
import { hashPassword } from "../src/lib/hash.js";

/**
 * Pruebas de integracion contra una base de datos PostgreSQL real (ver
 * auth.routes.test.ts). Requiere DATABASE_URL con las migraciones aplicadas.
 */

const env = loadEnv();
const prisma = new PrismaClient();

let app: FastifyInstance;

const CORREO_ESTUDIANTE = "estudiante.disponibilidad.test@uniquindio.edu.co";
const CORREO_TUTOR_ACTIVO = "tutor.activo.disponibilidad.test@uniquindio.edu.co";
const CORREO_TUTOR_INACTIVO = "tutor.inactivo.disponibilidad.test@uniquindio.edu.co";
const PASSWORD = "ClaveDePrueba123";

const CORREOS = [CORREO_ESTUDIANTE, CORREO_TUTOR_ACTIVO, CORREO_TUTOR_INACTIVO];

beforeAll(async () => {
  app = await buildApp(env);
  await app.ready();

  const passwordHash = await hashPassword(PASSWORD);

  await prisma.disponibilidad.deleteMany({ where: { tutor: { correo: { in: CORREOS } } } });
  await prisma.usuario.deleteMany({ where: { correo: { in: CORREOS } } });

  const estudiante = await prisma.usuario.create({
    data: { correo: CORREO_ESTUDIANTE, nombre: "Estudiante Test", rol: "ESTUDIANTE", passwordHash },
  });
  const tutorActivo = await prisma.usuario.create({
    data: { correo: CORREO_TUTOR_ACTIVO, nombre: "Tutor Activo Test", rol: "TUTOR", passwordHash },
  });
  const tutorInactivo = await prisma.usuario.create({
    data: { correo: CORREO_TUTOR_INACTIVO, nombre: "Tutor Inactivo Test", rol: "TUTOR", passwordHash, activo: false },
  });

  const enHoras = (horas: number) => new Date(Date.now() + horas * 60 * 60 * 1000);

  await prisma.disponibilidad.createMany({
    data: [
      // Futura, de un tutor activo: debe aparecer.
      {
        tutorId: tutorActivo.id,
        materia: "Materia Prueba Vigente",
        fechaInicio: enHoras(48),
        fechaFin: enHoras(49),
      },
      // Pasada: no debe aparecer.
      {
        tutorId: tutorActivo.id,
        materia: "Materia Prueba Vigente",
        fechaInicio: enHoras(-5),
        fechaFin: enHoras(-4),
      },
      // Futura, pero de un tutor inactivo: no debe aparecer.
      {
        tutorId: tutorInactivo.id,
        materia: "Materia Prueba Tutor Inactivo",
        fechaInicio: enHoras(24),
        fechaFin: enHoras(25),
      },
    ],
  });

  return { estudiante };
});

afterAll(async () => {
  await prisma.disponibilidad.deleteMany({ where: { tutor: { correo: { in: CORREOS } } } });
  await prisma.usuario.deleteMany({ where: { correo: { in: CORREOS } } });
  await prisma.$disconnect();
  await app.close();
});

async function iniciarSesion(correo: string) {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { correo, password: PASSWORD },
  });
  const cookie = login.cookies.find((c) => c.name === env.SESSION_COOKIE_NAME)!;
  return { [cookie.name]: cookie.value };
}

describe("GET /api/disponibilidad (RF-004)", () => {
  it("rechaza la peticion sin sesion activa", async () => {
    const response = await app.inject({ method: "GET", url: "/api/disponibilidad" });
    expect(response.statusCode).toBe(401);
  });

  it("devuelve solo franjas futuras de tutores activos, ordenadas por fecha", async () => {
    const cookies = await iniciarSesion(CORREO_ESTUDIANTE);

    const response = await app.inject({ method: "GET", url: "/api/disponibilidad", cookies });

    expect(response.statusCode).toBe(200);
    const { disponibilidades } = response.json();

    const materias = disponibilidades.map((d: { materia: string }) => d.materia);
    expect(materias).toContain("Materia Prueba Vigente");
    expect(materias).not.toContain("Materia Prueba Tutor Inactivo");

    const fechas = disponibilidades.map((d: { fechaInicio: string }) => new Date(d.fechaInicio).getTime());
    const fechasOrdenadas = [...fechas].sort((a, b) => a - b);
    expect(fechas).toEqual(fechasOrdenadas);

    const franjaCreada = disponibilidades.find((d: { materia: string }) => d.materia === "Materia Prueba Vigente");
    expect(franjaCreada.tutor.nombre).toBe("Tutor Activo Test");
  });
});
