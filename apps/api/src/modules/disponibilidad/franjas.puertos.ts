import type { EstadoFranja } from "@portal-tutorias/shared";
import { ErrorDeNegocio } from "../../lib/errors.js";

export interface FranjaConRelaciones {
  id: string;
  materia: { id: string; nombre: string };
  tutor: { id: string; nombre: string };
  fechaInicio: Date;
  fechaFin: Date;
  estado: EstadoFranja;
}

export interface DatosDeFranja {
  materiaId: string;
  fechaInicio: Date;
  fechaFin: Date;
}

export interface FranjaBloqueadaParaReserva {
  estado: EstadoFranja;
  fechaInicio: Date;
  tutorActivo: boolean;
}

export interface FranjaBloqueadaParaReprogramar {
  estado: EstadoFranja;
  fechaInicio: Date;
  tutorId: string;
}

/** SWR-04: la franja se cruza con otra franja vigente del mismo tutor. */
export class FranjaTraslapada extends ErrorDeNegocio {
  constructor() {
    super("La franja se traslapa con otra de tu agenda.", 409);
  }
}

/** Consultas de franjas; no requieren transacción. */
export interface LecturaDeFranjas {
  /** SWR-06 y SWR-07: franjas libres que comienzan desde `desde`, de tutores activos, ordenadas por fecha. */
  listarLibresProximas(filtros: { tutorId?: string; materiaId?: string }, desde: Date): Promise<FranjaConRelaciones[]>;
  /** Franjas no eliminadas del tutor que terminan desde `desde`, en cualquier estado, ordenadas por fecha. */
  listarVigentesDeTutor(tutorId: string, desde: Date): Promise<FranjaConRelaciones[]>;
  /** Carga una franja que se sabe existente; lanza si no existe. */
  cargar(id: string): Promise<DatosDeFranja>;
  /** Indica si el tutor tiene otra franja que se cruce con [inicio, fin). Las franjas contiguas no se cruzan. */
  existeTraslape(tutorId: string, inicio: Date, fin: Date, ignorarFranjaId?: string): Promise<boolean>;
}

export interface EscrituraDeFranjas {
  /** @throws FranjaTraslapada si la base de datos detecta un cruce con otra franja del tutor. */
  crear(datos: DatosDeFranja & { tutorId: string }): Promise<FranjaConRelaciones>;
  /** @throws FranjaTraslapada si la base de datos detecta un cruce con otra franja del tutor. */
  actualizar(id: string, datos: DatosDeFranja): Promise<FranjaConRelaciones>;
  /** Eliminación lógica: las citas que ya la usaron conservan su referencia. */
  marcarEliminada(id: string, cuando: Date): Promise<void>;
  cambiarEstado(id: string, estado: EstadoFranja): Promise<void>;
}

/**
 * Bloqueos de fila hasta el fin de la transacción, para que dos acciones
 * simultáneas sobre la misma franja se ejecuten una después de la otra.
 * Requieren transacción; todos devuelven null si la franja no existe o fue eliminada.
 */
export interface BloqueoDeFranjas {
  bloquearDelTutor(tutorId: string, franjaId: string): Promise<EstadoFranja | null>;
  bloquearParaReserva(franjaId: string): Promise<FranjaBloqueadaParaReserva | null>;
  bloquearParaReprogramar(franjaId: string): Promise<FranjaBloqueadaParaReprogramar | null>;
}

export interface RepositorioDeFranjas extends LecturaDeFranjas, EscrituraDeFranjas, BloqueoDeFranjas {}
