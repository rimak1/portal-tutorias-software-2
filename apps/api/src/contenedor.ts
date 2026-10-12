import type { PrismaClient } from "@prisma/client";
import type { Env } from "./config/env.js";
import { UnidadDeTrabajoPrisma } from "./db/unidad-de-trabajo.prisma.js";
import { relojDelSistema, type Reloj } from "./lib/reloj.js";
import type { Registro } from "./lib/registro.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { RecuperacionDePasswordService } from "./modules/auth/recuperacion-password.service.js";
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
  /** Se puede sustituir (p. ej. por un reloj fijo en las pruebas). */
  reloj?: Reloj;
}

/**
 * Raiz de composicion (inyeccion de dependencias): el unico lugar que conoce
 * las clases concretas y las conecta entre si. Los controladores reciben
 * servicios ya armados, y las pruebas pueden sustituir cualquier pieza.
 */
export function crearContenedor(dependencias: DependenciasDelContenedor): Contenedor {
  const { prisma, env, emailSender, registro, reloj = relojDelSistema } = dependencias;
  const uow = new UnidadDeTrabajoPrisma(prisma);

  const cambiosDeCita = new CambiosDeCita();
  cambiosDeCita.suscribir(registrarEnHistorial);
  const transiciones = new EjecutorDeTransiciones(uow, cambiosDeCita, reloj);

  return {
    sesiones: uow.repos.usuarios,
    auth: new AuthService(uow.repos.usuarios, env),
    recuperacion: new RecuperacionDePasswordService(uow.repos.usuarios, env, emailSender, registro),
    materias: new MateriasService(uow, reloj),
    consultaDisponibilidad: new ConsultaDeDisponibilidadService(uow.repos.franjas, reloj),
    gestionFranjas: new GestionDeFranjasService(uow, reloj),
    citasEstudiante: new CitasDelEstudianteService(uow, cambiosDeCita, transiciones, reloj),
    citasTutor: new CitasDelTutorService(uow, transiciones, reloj),
  };
}
