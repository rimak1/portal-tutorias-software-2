import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/hash.js";

const prisma = new PrismaClient();

const PASSWORD_DEMO = "Tutorias2026!";

async function upsertUsuario(correo: string, nombre: string, rol: "ESTUDIANTE" | "TUTOR" | "ADMINISTRADOR" | "COORDINADOR") {
  const passwordHash = await hashPassword(PASSWORD_DEMO);
  return prisma.usuario.upsert({
    where: { correo },
    // Se reafirman nombre/rol/contrasena en cada ejecucion para que las
    // cuentas de demostracion sean predecibles, incluso si ya existian.
    update: { nombre, rol, passwordHash, activo: true },
    create: { correo, nombre, rol, passwordHash },
  });
}

/** Suma dias y horas a la fecha actual, para que el seed siempre publique franjas futuras. */
function enHoras(horasDesdeAhora: number, duracionHoras: number) {
  const inicio = new Date(Date.now() + horasDesdeAhora * 60 * 60 * 1000);
  const fin = new Date(inicio.getTime() + duracionHoras * 60 * 60 * 1000);
  return { fechaInicio: inicio, fechaFin: fin };
}

/**
 * Reemplaza por completo las franjas de un tutor demo. Las fechas se calculan
 * en relacion a "ahora", asi que no son estables entre ejecuciones: en vez de
 * intentar detectar duplicados, cada corrida del seed deja el conjunto
 * correcto de franjas futuras para ese tutor.
 */
async function sembrarDisponibilidad(
  tutorId: string,
  franjas: Array<{ materia: string; horasDesdeAhora: number; duracionHoras: number }>,
) {
  await prisma.disponibilidad.deleteMany({ where: { tutorId } });
  await prisma.disponibilidad.createMany({
    data: franjas.map((franja) => ({ tutorId, materia: franja.materia, ...enHoras(franja.horasDesdeAhora, franja.duracionHoras) })),
  });
}

async function main() {
  const admin = await upsertUsuario("admin@uniquindio.edu.co", "Admin Portal", "ADMINISTRADOR");
  await upsertUsuario("coordinador@uniquindio.edu.co", "Coordinador Academico", "COORDINADOR");
  await upsertUsuario("estudiante@uniquindio.edu.co", "Estudiante Demo", "ESTUDIANTE");

  const tutorDemo = await upsertUsuario("tutor@uniquindio.edu.co", "Tutor Demo", "TUTOR");
  const tutorAna = await upsertUsuario("ana.martinez@uniquindio.edu.co", "Ana Martínez", "TUTOR");
  const tutorCarlos = await upsertUsuario("carlos.gomez@uniquindio.edu.co", "Carlos Gómez", "TUTOR");

  await sembrarDisponibilidad(tutorDemo.id, [
    { materia: "Bases de Datos", horasDesdeAhora: 26, duracionHoras: 1 },
    { materia: "Bases de Datos", horasDesdeAhora: 74, duracionHoras: 1.5 },
  ]);
  await sembrarDisponibilidad(tutorAna.id, [
    { materia: "Cálculo I", horasDesdeAhora: 20, duracionHoras: 1 },
    { materia: "Álgebra Lineal", horasDesdeAhora: 44, duracionHoras: 1 },
  ]);
  await sembrarDisponibilidad(tutorCarlos.id, [
    { materia: "Programación I", horasDesdeAhora: 30, duracionHoras: 2 },
    { materia: "Estructuras de Datos", horasDesdeAhora: 96, duracionHoras: 1.5 },
  ]);

  console.log("Usuarios de prueba creados. Contrasena para todos:", PASSWORD_DEMO);
  console.log("Creados/actualizados por:", admin.correo, "(referencia, sin relacion real de creado_por)");
  console.log("Franjas de disponibilidad de ejemplo sembradas para 3 tutores.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
