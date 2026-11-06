import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { crearCuentaSchema } from "@portal-tutorias/shared";
import { hashPassword } from "../src/lib/hash.js";

/**
 * Crea la primera cuenta de administrador de un entorno (el seed solo sirve para desarrollo y
 * las demás cuentas las crea un administrador desde la aplicación).
 *
 * Uso:  npm run crear:administrador -- correo@institucion.edu.co "Nombre Completo"
 * En Docker:  docker compose exec api npx tsx prisma/crear-administrador.ts correo "Nombre Completo"
 *
 * La contraseña se genera al azar y se imprime una sola vez; conviene cambiarla en el primer
 * ingreso con «¿Olvidaste tu contraseña?».
 */
async function main() {
  const [correo, nombre] = process.argv.slice(2);
  if (!correo || !nombre) {
    console.error('Uso: crear-administrador <correo> "<nombre completo>"');
    process.exit(1);
  }

  const password = randomBytes(12).toString("base64url");
  const datos = crearCuentaSchema.safeParse({ correo, nombre, rol: "ADMINISTRADOR", password });
  if (!datos.success) {
    console.error(datos.error.issues[0]?.message ?? "Los datos no son válidos.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    if (await prisma.usuario.findUnique({ where: { correo: datos.data.correo } })) {
      console.error("Ya existe una cuenta con ese correo.");
      process.exit(1);
    }
    await prisma.usuario.create({
      data: { correo: datos.data.correo, nombre: datos.data.nombre, rol: "ADMINISTRADOR", passwordHash: await hashPassword(password) },
    });
    console.log(`Administrador creado: ${datos.data.correo}`);
    console.log(`Contraseña inicial (no se vuelve a mostrar): ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
