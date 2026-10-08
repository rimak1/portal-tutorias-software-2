import "dotenv/config";
import type { FastifyInstance } from "fastify";
import { PrismaClient, type RolUsuario } from "@prisma/client";
import { loadEnv } from "../src/config/env.js";
import { hashPassword } from "../src/lib/hash.js";

/**
 * Utilidades de las pruebas de integracion. Cada archivo de pruebas trabaja con
 * un prefijo propio en sus correos y materias, de modo que los archivos puedan
 * correr en paralelo sobre la misma base de datos sin pisarse.
 */

export const env = loadEnv();
export const prisma = new PrismaClient();
export const PASSWORD = "ClaveDePrueba123";

export const enHoras = (horas: number) => new Date(Date.now() + horas * 60 * 60 * 1000);

export async function crearUsuario(prefijo: string, nombre: string, rol: RolUsuario, activo = true) {
  const correo = `${prefijo}.${nombre.toLowerCase().replace(/\s+/g, "")}@test.uniquindio.edu.co`;
  return prisma.usuario.create({
    data: { correo, nombre, rol, activo, passwordHash: await hashPassword(PASSWORD) },
  });
}

export async function iniciarSesion(app: FastifyInstance, correo: string) {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { correo, password: PASSWORD },
  });
  const cookie = login.cookies.find((c) => c.name === env.SESSION_COOKIE_NAME)!;
  return { [cookie.name]: cookie.value };
}

/** Crea una franja directamente en la base (sin pasar por las reglas de la API). */
export async function crearFranja(
  tutorId: string,
  materiaId: string,
  inicio: Date,
  fin: Date,
  estado: "LIBRE" | "RESERVADA" = "LIBRE",
) {
  return prisma.disponibilidad.create({
    data: { tutorId, materiaId, fechaInicio: inicio, fechaFin: fin, estado },
  });
}

/** Borra todo lo creado por un archivo de pruebas, respetando el orden de las claves foraneas. */
export async function limpiar(prefijo: string) {
  const usuarios = await prisma.usuario.findMany({ where: { correo: { startsWith: `${prefijo}.` } }, select: { id: true } });
  const ids = usuarios.map((u) => u.id);
  const citas = { OR: [{ estudianteId: { in: ids } }, { franja: { tutorId: { in: ids } } }] };

  await prisma.historialEstadoCita.deleteMany({ where: { OR: [{ cita: citas }, { actorId: { in: ids } }] } });
  await prisma.propuestaReprogramacion.deleteMany({ where: { cita: citas } });
  await prisma.cita.deleteMany({ where: citas });
  await prisma.disponibilidad.deleteMany({ where: { tutorId: { in: ids } } });
  await prisma.tutorMateria.deleteMany({ where: { tutorId: { in: ids } } });
  await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
  await prisma.materia.deleteMany({ where: { nombre: { startsWith: prefijo } } });
}
