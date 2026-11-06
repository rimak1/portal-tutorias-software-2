import type { EstadoCita, EstadoPropuesta } from "@portal-tutorias/shared";
import { ErrorDeNegocio } from "../../lib/errors.js";

export interface RangoDeFranja {
  id: string;
  fechaInicio: Date;
  fechaFin: Date;
}

/** Cita con lo necesario para decidir sobre ella y presentarla. */
export interface CitaConRelaciones {
  id: string;
  estado: EstadoCita;
  motivoRechazo: string | null;
  creadoEn: Date;
  fechaFinalizacion: Date | null;
  estudiante: { id: string; nombre: string };
  franja: RangoDeFranja & { materia: { nombre: string }; tutor: { id: string; nombre: string } };
  /** Solo las propuestas de reprogramación que esperan respuesta (como máximo una). */
  propuestas: Array<{ id: string; franjaOriginal: RangoDeFranja }>;
}

export interface CamposDeCita {
  estado?: EstadoCita;
  motivoRechazo?: string;
  franjaId?: string;
  fechaFinalizacion?: Date;
}

export interface RegistroDeHistorial {
  citaId: string;
  estadoAnterior: EstadoCita | null;
  estadoNuevo: EstadoCita;
  actorId: string;
  detalle: string;
}

export type RespuestaAPropuesta = Exclude<EstadoPropuesta, "PENDIENTE">;

/** SWR-09: la franja ya tiene otra cita activa (pendiente o aprobada). */
export class FranjaYaReservada extends ErrorDeNegocio {
  constructor() {
    super("La franja ya fue reservada por otro estudiante. Elige otra.", 409);
  }
}

export interface LecturaDeCitas {
  /** Citas del estudiante, de la más reciente a la más antigua. */
  listarDeEstudiante(estudianteId: string): Promise<CitaConRelaciones[]>;
  /** Citas sobre las franjas del tutor, de la más reciente a la más antigua. */
  listarDeTutor(tutorId: string): Promise<CitaConRelaciones[]>;
}

export interface EscrituraDeCitas {
  /**
   * Crea la cita en estado Pendiente.
   *
   * @throws FranjaYaReservada si la franja ya tiene una cita activa.
   */
  crear(estudianteId: string, franjaId: string): Promise<{ id: string }>;
  actualizar(id: string, cambios: CamposDeCita): Promise<void>;
  crearPropuesta(datos: { citaId: string; franjaOriginalId: string; franjaNuevaId: string }): Promise<void>;
  cerrarPropuesta(id: string, respuesta: RespuestaAPropuesta, respondidaEn: Date): Promise<void>;
  registrarHistorial(registro: RegistroDeHistorial): Promise<void>;
}

export interface BloqueoDeCitas {
  /** Carga una cita que se sabe existente; lanza si no existe. */
  cargar(id: string): Promise<CitaConRelaciones>;
  /** Bloquea la fila de la cita hasta el fin de la transacción; null si no existe. Requiere transacción. */
  bloquearYCargar(id: string): Promise<CitaConRelaciones | null>;
}

/** Filtros del histórico (F-09); todos opcionales y combinables. */
export interface FiltroDeHistorico {
  /** Incluye las citas cuya franja comienza en este instante o después. */
  desde?: Date;
  /** Solo las citas cuya franja comienza antes de este instante. */
  hasta?: Date;
  tutorId?: string;
  materiaId?: string;
  estado?: EstadoCita;
}

/** Un cambio de estado de la bitácora de una cita, con el nombre de quien lo hizo. */
export interface EventoGuardado {
  estadoAnterior: EstadoCita | null;
  estadoNuevo: EstadoCita;
  actor: { id: string; nombre: string };
  detalle: string | null;
  creadoEn: Date;
}

/** Consulta del histórico de tutorías de todos los usuarios (F-09). */
export interface HistoricoDeCitas {
  /** Citas que cumplen el filtro, de la franja más reciente a la más antigua, hasta `limite`. */
  buscarEnHistorico(filtro: FiltroDeHistorico, limite: number): Promise<CitaConRelaciones[]>;
  /** Null si la cita no existe. */
  buscar(id: string): Promise<CitaConRelaciones | null>;
  /** Cambios de estado de la cita, del más antiguo al más reciente. */
  listarEventos(citaId: string): Promise<EventoGuardado[]>;
}

export interface RepositorioDeCitas extends LecturaDeCitas, EscrituraDeCitas, BloqueoDeCitas, HistoricoDeCitas {}
