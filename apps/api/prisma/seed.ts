import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/hash.js";

const prisma = new PrismaClient();

const PASSWORD_DEMO = "Tutorias2026!";

const CATALOGO_MATERIAS = [
  "Álgebra Lineal",
  "Bases de Datos",
  "Cálculo I",
  "Cálculo II",
  "Estadística",
  "Estructuras de Datos",
  "Física I",
  "Ingeniería de Software",
  "Programación I",
];

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

async function sembrarCatalogoDeMaterias(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const nombre of CATALOGO_MATERIAS) {
    const materia = await prisma.materia.upsert({ where: { nombre }, update: {}, create: { nombre } });
    ids.set(nombre, materia.id);
  }
  return ids;
}

/** Deja al tutor con exactamente estas materias en su perfil (SWR-20). */
async function asignarMaterias(tutorId: string, materiaIds: string[]) {
  await prisma.tutorMateria.deleteMany({ where: { tutorId } });
  await prisma.tutorMateria.createMany({ data: materiaIds.map((materiaId) => ({ tutorId, materiaId })) });
}

/**
 * Reemplaza por completo la agenda de un tutor demo, incluidas las citas que
 * hubiera sobre ella. Las fechas se calculan en relacion a "ahora", asi que no
 * son estables entre ejecuciones: cada corrida deja el conjunto correcto de
 * franjas futuras y libres para ese tutor.
 */
async function sembrarDisponibilidad(
  tutorId: string,
  materias: Map<string, string>,
  franjas: Array<{ materia: string; horasDesdeAhora: number; duracionHoras: number }>,
) {
  const existentes = await prisma.disponibilidad.findMany({ where: { tutorId }, select: { id: true } });
  const ids = existentes.map((franja) => franja.id);

  await prisma.historialEstadoCita.deleteMany({ where: { cita: { franjaId: { in: ids } } } });
  await prisma.propuestaReprogramacion.deleteMany({ where: { cita: { franjaId: { in: ids } } } });
  await prisma.cita.deleteMany({ where: { franjaId: { in: ids } } });
  await prisma.disponibilidad.deleteMany({ where: { tutorId } });

  await prisma.disponibilidad.createMany({
    data: franjas.map((franja) => ({
      tutorId,
      materiaId: materias.get(franja.materia)!,
      ...enHoras(franja.horasDesdeAhora, franja.duracionHoras),
    })),
  });
}

async function main() {
  const admin = await upsertUsuario("admin@uniquindio.edu.co", "Admin Portal", "ADMINISTRADOR");
  await upsertUsuario("coordinador@uniquindio.edu.co", "Coordinador Academico", "COORDINADOR");
  await upsertUsuario("estudiante@uniquindio.edu.co", "Estudiante Demo", "ESTUDIANTE");
  await upsertUsuario("estudiante2@uniquindio.edu.co", "Laura Rojas", "ESTUDIANTE");

  const tutorDemo = await upsertUsuario("tutor@uniquindio.edu.co", "Tutor Demo", "TUTOR");
  const tutorAna = await upsertUsuario("ana.martinez@uniquindio.edu.co", "Ana Martínez", "TUTOR");
  const tutorCarlos = await upsertUsuario("carlos.gomez@uniquindio.edu.co", "Carlos Gómez", "TUTOR");

  const materias = await sembrarCatalogoDeMaterias();
  const id = (nombre: string) => materias.get(nombre)!;

  await asignarMaterias(tutorDemo.id, [id("Bases de Datos"), id("Ingeniería de Software")]);
  await asignarMaterias(tutorAna.id, [id("Cálculo I"), id("Álgebra Lineal")]);
  await asignarMaterias(tutorCarlos.id, [id("Programación I"), id("Estructuras de Datos")]);

  await sembrarDisponibilidad(tutorDemo.id, materias, [
    { materia: "Bases de Datos", horasDesdeAhora: 26, duracionHoras: 1 },
    { materia: "Bases de Datos", horasDesdeAhora: 74, duracionHoras: 1.5 },
  ]);
  await sembrarDisponibilidad(tutorAna.id, materias, [
    { materia: "Cálculo I", horasDesdeAhora: 20, duracionHoras: 1 },
    { materia: "Álgebra Lineal", horasDesdeAhora: 44, duracionHoras: 1 },
  ]);
  await sembrarDisponibilidad(tutorCarlos.id, materias, [
    { materia: "Programación I", horasDesdeAhora: 30, duracionHoras: 2 },
    { materia: "Estructuras de Datos", horasDesdeAhora: 96, duracionHoras: 1.5 },
  ]);

  console.log("Usuarios de prueba creados. Contrasena para todos:", PASSWORD_DEMO);
  console.log("Creados/actualizados por:", admin.correo, "(referencia, sin relacion real de creado_por)");
  console.log(`Catalogo de ${CATALOGO_MATERIAS.length} materias y franjas de ejemplo sembradas para 3 tutores.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
