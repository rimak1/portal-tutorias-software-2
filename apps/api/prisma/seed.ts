import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/hash.js";

/**
 * Datos de demostración para desarrollo. Crea cuentas de todos los roles (incluida
 * una de administrador) con una contraseña conocida por quien lo ejecuta, así que
 * jamás debe correr contra una base de datos real.
 */
if (process.env.NODE_ENV === "production") {
  console.error("El seed crea cuentas de demostración y no puede ejecutarse con NODE_ENV=production.");
  process.exit(1);
}

const prisma = new PrismaClient();

/**
 * Contraseña de las cuentas de demostración: se genera en cada ejecución y se
 * imprime al final, para que no haya una credencial fija en un repositorio público.
 */
const PASSWORD_DEMO = `Demo-${randomBytes(6).toString("hex")}`;

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

type EstadoHistorico = "FINALIZADA" | "RECHAZADA" | "CANCELADA";

/**
 * Tutorías ya concluidas de un tutor con un estudiante, con su bitácora, para que
 * el histórico y los reportes (F-09) tengan datos que mostrar. Las franjas quedan
 * en el pasado: no aparecen en la consulta de disponibilidad.
 */
async function sembrarHistorico(
  tutorId: string,
  estudianteId: string,
  materiaId: string,
  casos: Array<{ horasAtras: number; duracionHoras: number; estado: EstadoHistorico; motivo?: string }>,
) {
  for (const caso of casos) {
    const { fechaInicio, fechaFin } = enHoras(-caso.horasAtras, caso.duracionHoras);
    const franja = await prisma.disponibilidad.create({
      data: { tutorId, materiaId, fechaInicio, fechaFin, estado: caso.estado === "FINALIZADA" ? "RESERVADA" : "LIBRE" },
    });
    const cita = await prisma.cita.create({
      data: {
        estudianteId,
        franjaId: franja.id,
        estado: caso.estado,
        motivoRechazo: caso.estado === "RECHAZADA" ? caso.motivo : undefined,
        fechaFinalizacion: caso.estado === "FINALIZADA" ? fechaFin : undefined,
        creadoEn: new Date(fechaInicio.getTime() - 48 * 60 * 60 * 1000),
      },
    });
    const actorFinal = caso.estado === "CANCELADA" ? estudianteId : tutorId;
    const hechoPor = caso.estado === "FINALIZADA" ? "Tutoría finalizada" : caso.estado === "RECHAZADA" ? (caso.motivo ?? "Solicitud rechazada") : "Cita cancelada por el estudiante";
    await prisma.historialEstadoCita.createMany({
      data: [
        { citaId: cita.id, estadoAnterior: null, estadoNuevo: "PENDIENTE", actorId: estudianteId, detalle: "Solicitud de tutoría creada", creadoEn: cita.creadoEn },
        ...(caso.estado === "FINALIZADA"
          ? [{ citaId: cita.id, estadoAnterior: "PENDIENTE" as const, estadoNuevo: "APROBADA" as const, actorId: tutorId, detalle: "Solicitud aprobada", creadoEn: new Date(fechaInicio.getTime() - 24 * 60 * 60 * 1000) }]
          : []),
        {
          citaId: cita.id,
          estadoAnterior: caso.estado === "FINALIZADA" ? ("APROBADA" as const) : ("PENDIENTE" as const),
          estadoNuevo: caso.estado,
          actorId: actorFinal,
          detalle: hechoPor,
          creadoEn: caso.estado === "FINALIZADA" ? fechaFin : new Date(fechaInicio.getTime() - 12 * 60 * 60 * 1000),
        },
      ],
    });
  }
}

async function main() {
  const admin = await upsertUsuario("admin@uniquindio.edu.co", "Admin Portal", "ADMINISTRADOR");
  await upsertUsuario("coordinador@uniquindio.edu.co", "Coordinador Academico", "COORDINADOR");
  const estudianteDemo = await upsertUsuario("estudiante@uniquindio.edu.co", "Estudiante Demo", "ESTUDIANTE");
  const estudianteLaura = await upsertUsuario("estudiante2@uniquindio.edu.co", "Laura Rojas", "ESTUDIANTE");

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

  await sembrarHistorico(tutorDemo.id, estudianteDemo.id, id("Bases de Datos"), [
    { horasAtras: 24 * 12, duracionHoras: 1, estado: "FINALIZADA" },
    { horasAtras: 24 * 6, duracionHoras: 1.5, estado: "FINALIZADA" },
    { horasAtras: 24 * 3, duracionHoras: 1, estado: "RECHAZADA", motivo: "No atiendo ese día" },
  ]);
  await sembrarHistorico(tutorAna.id, estudianteLaura.id, id("Cálculo I"), [
    { horasAtras: 24 * 9, duracionHoras: 1, estado: "FINALIZADA" },
    { horasAtras: 24 * 2, duracionHoras: 1, estado: "CANCELADA" },
  ]);
  await sembrarHistorico(tutorCarlos.id, estudianteDemo.id, id("Programación I"), [
    { horasAtras: 24 * 15, duracionHoras: 2, estado: "FINALIZADA" },
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
