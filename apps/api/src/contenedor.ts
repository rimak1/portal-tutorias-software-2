import type { PrismaClient } from "@prisma/client";
import type { Env } from "./config/env.js";
import { UnidadDeTrabajo } from "./db/unidad-de-trabajo.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { CambiosDeCita, registrarEnHistorial } from "./modules/citas/citas.eventos.js";
import { CitasService } from "./modules/citas/citas.service.js";
import { DisponibilidadService } from "./modules/disponibilidad/disponibilidad.service.js";
import type { EmailSender } from "./modules/email/email-sender.js";
import { MateriasService } from "./modules/materias/materias.service.js";
import type { UsuariosRepository } from "./modules/usuarios/usuarios.repository.js";

export interface Contenedor {
  usuarios: UsuariosRepository;
  auth: AuthService;
  materias: MateriasService;
  disponibilidad: DisponibilidadService;
  citas: CitasService;
}

/**
 * Raiz de composicion (inyeccion de dependencias): el unico lugar que conoce
 * las clases concretas y las conecta entre si. Los controladores reciben
 * servicios ya armados, y las pruebas pueden sustituir cualquier pieza.
 */
export function crearContenedor(dependencias: { prisma: PrismaClient; env: Env; emailSender: EmailSender }): Contenedor {
  const { prisma, env, emailSender } = dependencias;
  const uow = new UnidadDeTrabajo(prisma);

  const cambiosDeCita = new CambiosDeCita();
  cambiosDeCita.suscribir(registrarEnHistorial);

  return {
    usuarios: uow.repos.usuarios,
    auth: new AuthService(uow.repos.usuarios, env, emailSender),
    materias: new MateriasService(uow),
    disponibilidad: new DisponibilidadService(uow),
    citas: new CitasService(uow, cambiosDeCita),
  };
}
