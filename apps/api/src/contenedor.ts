import type { PrismaClient } from "@prisma/client";
import type { Env } from "./config/env.js";
import { UnidadDeTrabajoPrisma } from "./db/unidad-de-trabajo.prisma.js";
import { relojDelSistema, type Reloj } from "./lib/reloj.js";
import type { Registro } from "./lib/registro.js";
import type { TokensDeSesion } from "./modules/auth/auth.puertos.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { cifradoArgon2 } from "./modules/auth/cifrado-argon2.js";
import { RecuperacionDePasswordService } from "./modules/auth/recuperacion-password.service.js";
import { crearTokensDeRestablecimiento, crearTokensDeSesion } from "./modules/auth/tokens-jwt.js";
import { CambiosDeCita, registrarEnHistorial } from "./modules/citas/citas.eventos.js";
import { CitasDelEstudianteService } from "./modules/citas/citas-del-estudiante.service.js";
import { CitasDelTutorService } from "./modules/citas/citas-del-tutor.service.js";
import { EjecutorDeTransiciones } from "./modules/citas/ejecutor-de-transiciones.js";
import { ConsultaDeDisponibilidadService } from "./modules/disponibilidad/consulta-disponibilidad.service.js";
import { GestionDeFranjasService } from "./modules/disponibilidad/gestion-franjas.service.js";
import type { EmailSender } from "./modules/email/email-sender.js";
import { MateriasService } from "./modules/materias/materias.service.js";
import type { ConsultaDeSesion } from "./modules/usuarios/usuarios.puertos.js";

export interface Contenedor {
  sesiones: ConsultaDeSesion;
  tokensDeSesion: TokensDeSesion;
  auth: AuthService;
  recuperacion: RecuperacionDePasswordService;
  materias: MateriasService;
  consultaDisponibilidad: ConsultaDeDisponibilidadService;
  gestionFranjas: GestionDeFranjasService;
  citasEstudiante: CitasDelEstudianteService;
  citasTutor: CitasDelTutorService;
}

export interface DependenciasDelContenedor {
  prisma: PrismaClient;
  env: Env;
  emailSender: EmailSender;
  registro: Registro;
  /** Por defecto, la hora del sistema. */
  reloj?: Reloj;
}

/**
 * Crea los servicios de la aplicación con sus implementaciones concretas
 * (Prisma, argon2, JWT). Es el único módulo que las conoce: las rutas reciben
 * los servicios ya armados.
 */
export function crearContenedor(dependencias: DependenciasDelContenedor): Contenedor {
  const { prisma, env, emailSender, registro, reloj = relojDelSistema } = dependencias;
  const uow = new UnidadDeTrabajoPrisma(prisma);
  const tokensDeSesion = crearTokensDeSesion(env);

  const cambiosDeCita = new CambiosDeCita();
  cambiosDeCita.suscribir(registrarEnHistorial);
  const transiciones = new EjecutorDeTransiciones(uow, cambiosDeCita, reloj);

  return {
    sesiones: uow.repos.usuarios,
    tokensDeSesion,
    auth: new AuthService(uow.repos.usuarios, cifradoArgon2, tokensDeSesion),
    recuperacion: new RecuperacionDePasswordService({
      cuentas: uow.repos.usuarios,
      cifrado: cifradoArgon2,
      tokens: crearTokensDeRestablecimiento(env),
      correo: emailSender,
      registro,
      urlWeb: env.WEB_APP_URL,
    }),
    materias: new MateriasService(uow, reloj),
    consultaDisponibilidad: new ConsultaDeDisponibilidadService(uow.repos.franjas, reloj),
    gestionFranjas: new GestionDeFranjasService(uow, reloj),
    citasEstudiante: new CitasDelEstudianteService(uow, cambiosDeCita, transiciones, reloj),
    citasTutor: new CitasDelTutorService(uow, transiciones, reloj),
  };
}
