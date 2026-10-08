import type { EstadoCita, EstadoFranja } from "@portal-tutorias/shared";

const ETIQUETA_CITA: Record<EstadoCita, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
  FINALIZADA: "Finalizada",
};

const ETIQUETA_FRANJA: Record<EstadoFranja, string> = {
  LIBRE: "Libre",
  RESERVADA: "Reservada",
};

export function EstadoCitaBadge({ estado }: { estado: EstadoCita }) {
  return <span className={`insignia insignia--${estado.toLowerCase()}`}>{ETIQUETA_CITA[estado]}</span>;
}

export function EstadoFranjaBadge({ estado }: { estado: EstadoFranja }) {
  return <span className={`insignia insignia--franja-${estado.toLowerCase()}`}>{ETIQUETA_FRANJA[estado]}</span>;
}
