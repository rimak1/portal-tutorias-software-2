import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/hash.js";

const prisma = new PrismaClient();

const PASSWORD_DEMO = "Tutorias2026!";

async function upsertUsuario(correo: string, nombre: string, rol: "ESTUDIANTE" | "TUTOR" | "ADMINISTRADOR" | "COORDINADOR") {
  const passwordHash = await hashPassword(PASSWORD_DEMO);
  return prisma.usuario.upsert({
    where: { correo },
    update: {},
    create: { correo, nombre, rol, passwordHash },
  });
}

async function main() {
  const admin = await upsertUsuario("admin@uniquindio.edu.co", "Admin Portal", "ADMINISTRADOR");
  await upsertUsuario("coordinador@uniquindio.edu.co", "Coordinador Academico", "COORDINADOR");
  await upsertUsuario("tutor@uniquindio.edu.co", "Tutor Demo", "TUTOR");
  await upsertUsuario("estudiante@uniquindio.edu.co", "Estudiante Demo", "ESTUDIANTE");

  console.log("Usuarios de prueba creados. Contrasena para todos:", PASSWORD_DEMO);
  console.log("Creados/actualizados por:", admin.correo, "(referencia, sin relacion real de creado_por)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
