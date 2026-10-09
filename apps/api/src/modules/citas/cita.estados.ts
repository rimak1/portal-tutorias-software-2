import type { EstadoCita } from "@portal-tutorias/shared";
import { conflicto } from "../../lib/errors.js";

/** Lo que un estado necesita saber de la cita para decidir si una accion es valida. */
export interface ContextoCita {
  tienePropuestaPendiente: boolean;
  inicioFranja: Date;
  ahora: Date;
}

/** Resultado de una accion valida: a que estado pasa la cita y si libera la franja que ocupa (RN-007). */
export interface Transicion {
  hacia: EstadoCita;
  liberaFranja: boolean;
  detalle: string;
}

const MENSAJE_SIN_PROPUESTA = "Esta cita no tiene una propuesta de reprogramación pendiente.";
const MENSAJE_CON_PROPUESTA = "Esta solicitud tiene una propuesta de reprogramación esperando respuesta del estudiante.";

/**
 * Patron State (RN-006): cada estado de la cita decide que acciones admite y
 * a donde llevan. Por defecto una accion es invalida; cada estado concreto
 * sobrescribe solo las que permite, asi que agregar un estado o una transicion
 * no obliga a tocar condicionales dispersos por el servicio.
 */
export abstract class EstadoDeCita {
  abstract readonly nombre: EstadoCita;

  aprobar(_contexto: ContextoCita): Transicion {
    throw conflicto("Solo se puede aprobar una solicitud pendiente.");
  }

  rechazar(_contexto: ContextoCita): Transicion {
    throw conflicto("Solo se puede rechazar una solicitud pendiente.");
  }

  reprogramar(_contexto: ContextoCita): Transicion {
    throw conflicto("Solo se puede reprogramar una solicitud pendiente.");
  }

  aceptarPropuesta(_contexto: ContextoCita): Transicion {
    throw conflicto(MENSAJE_SIN_PROPUESTA);
  }

  rechazarPropuesta(_contexto: ContextoCita): Transicion {
    throw conflicto(MENSAJE_SIN_PROPUESTA);
  }

  cancelar(_contexto: ContextoCita): Transicion {
    throw conflicto("Solo se puede cancelar una cita pendiente o aprobada.");
  }

  finalizar(_contexto: ContextoCita): Transicion {
    throw conflicto("Solo se puede finalizar una cita aprobada.");
  }
}

class EstadoPendiente extends EstadoDeCita {
  readonly nombre = "PENDIENTE" as const;

  aprobar(contexto: ContextoCita): Transicion {
    this.exigirSinPropuesta(contexto);
    return { hacia: "APROBADA", liberaFranja: false, detalle: "Solicitud aprobada" };
  }

  rechazar(contexto: ContextoCita): Transicion {
    this.exigirSinPropuesta(contexto);
    return { hacia: "RECHAZADA", liberaFranja: true, detalle: "Solicitud rechazada" };
  }

  reprogramar(contexto: ContextoCita): Transicion {
    this.exigirSinPropuesta(contexto);
    return { hacia: "PENDIENTE", liberaFranja: true, detalle: "Reprogramación propuesta por el tutor" };
  }

  aceptarPropuesta(contexto: ContextoCita): Transicion {
    this.exigirPropuesta(contexto);
    return { hacia: "APROBADA", liberaFranja: false, detalle: "Propuesta de reprogramación aceptada" };
  }

  rechazarPropuesta(contexto: ContextoCita): Transicion {
    this.exigirPropuesta(contexto);
    return { hacia: "CANCELADA", liberaFranja: true, detalle: "Propuesta de reprogramación rechazada" };
  }

  cancelar(): Transicion {
    return { hacia: "CANCELADA", liberaFranja: true, detalle: "Cita cancelada por el estudiante" };
  }

  private exigirSinPropuesta(contexto: ContextoCita): void {
    if (contexto.tienePropuestaPendiente) throw conflicto(MENSAJE_CON_PROPUESTA);
  }

  private exigirPropuesta(contexto: ContextoCita): void {
    if (!contexto.tienePropuestaPendiente) throw conflicto(MENSAJE_SIN_PROPUESTA);
  }
}

class EstadoAprobada extends EstadoDeCita {
  readonly nombre = "APROBADA" as const;

  cancelar(): Transicion {
    return { hacia: "CANCELADA", liberaFranja: true, detalle: "Cita cancelada por el estudiante" };
  }

  finalizar(contexto: ContextoCita): Transicion {
    if (contexto.inicioFranja > contexto.ahora) {
      throw conflicto("Solo puedes finalizar la tutoría desde su hora de inicio.");
    }
    return { hacia: "FINALIZADA", liberaFranja: false, detalle: "Tutoría finalizada" };
  }
}

/** Rechazada, Cancelada y Finalizada son terminales: no admiten ninguna accion. */
class EstadoTerminal extends EstadoDeCita {
  constructor(readonly nombre: EstadoCita) {
    super();
  }
}

const ESTADOS: Record<EstadoCita, EstadoDeCita> = {
  PENDIENTE: new EstadoPendiente(),
  APROBADA: new EstadoAprobada(),
  RECHAZADA: new EstadoTerminal("RECHAZADA"),
  CANCELADA: new EstadoTerminal("CANCELADA"),
  FINALIZADA: new EstadoTerminal("FINALIZADA"),
};

export function estadoDe(estado: EstadoCita): EstadoDeCita {
  return ESTADOS[estado];
}
