import type { EstadoFranja } from "@portal-tutorias/shared";

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

/** Consultas: no necesitan transaccion ni conocen como se escribe. */
export interface LecturaDeFranjas {
  /** SWR-06 / SWR-07: franjas libres que comienzan desde `desde`, de tutores activos, por fecha. */
  listarLibresProximas(filtros: { tutorId?: string; materiaId?: string }, desde: Date): Promise<FranjaConRelaciones[]>;
  listarVigentesDeTutor(tutorId: string, desde: Date): Promise<FranjaConRelaciones[]>;
  cargar(id: string): Promise<DatosDeFranja>;
  /** Las franjas contiguas (fin == inicio) no se consideran traslapadas. */
  existeTraslape(tutorId: string, inicio: Date, fin: Date, ignorarFranjaId?: string): Promise<boolean>;
}

export interface EscrituraDeFranjas {
  crear(datos: DatosDeFranja & { tutorId: string }): Promise<FranjaConRelaciones>;
  actualizar(id: string, datos: DatosDeFranja): Promise<FranjaConRelaciones>;
  marcarEliminada(id: string, cuando: Date): Promise<void>;
  cambiarEstado(id: string, estado: EstadoFranja): Promise<void>;
}

/** Bloqueos de fila para serializar acciones simultaneas; solo tienen sentido dentro de una transaccion. */
export interface BloqueoDeFranjas {
  bloquearDelTutor(tutorId: string, franjaId: string): Promise<EstadoFranja | null>;
  bloquearParaReserva(franjaId: string): Promise<FranjaBloqueadaParaReserva | null>;
  bloquearParaReprogramar(franjaId: string): Promise<FranjaBloqueadaParaReprogramar | null>;
}

export interface RepositorioDeFranjas extends LecturaDeFranjas, EscrituraDeFranjas, BloqueoDeFranjas {}
