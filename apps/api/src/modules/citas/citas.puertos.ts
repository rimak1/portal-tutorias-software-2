import type { EstadoCita } from "@portal-tutorias/shared";

export interface RangoDeFranja {
  id: string;
  fechaInicio: Date;
  fechaFin: Date;
}

/** Cita con lo necesario para decidir y presentar; no depende de ningun ORM. */
export interface CitaConRelaciones {
  id: string;
  estado: EstadoCita;
  motivoRechazo: string | null;
  creadoEn: Date;
  fechaFinalizacion: Date | null;
  estudiante: { id: string; nombre: string };
  franja: RangoDeFranja & { materia: { nombre: string }; tutor: { id: string; nombre: string } };
  /** Solo las propuestas pendientes de respuesta. */
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

export interface LecturaDeCitas {
  listarDeEstudiante(estudianteId: string): Promise<CitaConRelaciones[]>;
  listarDeTutor(tutorId: string): Promise<CitaConRelaciones[]>;
}

export interface EscrituraDeCitas {
  crear(estudianteId: string, franjaId: string): Promise<{ id: string }>;
  actualizar(id: string, cambios: CamposDeCita): Promise<void>;
  crearPropuesta(datos: { citaId: string; franjaOriginalId: string; franjaNuevaId: string }): Promise<void>;
  cerrarPropuesta(id: string, estado: "ACEPTADA" | "RECHAZADA"): Promise<void>;
  registrarHistorial(registro: RegistroDeHistorial): Promise<void>;
}

export interface BloqueoDeCitas {
  cargar(id: string): Promise<CitaConRelaciones>;
  /** Bloquea la cita (FOR UPDATE); null si no existe. Requiere transaccion. */
  bloquearYCargar(id: string): Promise<CitaConRelaciones | null>;
}

export interface RepositorioDeCitas extends LecturaDeCitas, EscrituraDeCitas, BloqueoDeCitas {}
