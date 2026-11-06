import { ESTADOS_CITA, type EstadoCita } from "@portal-tutorias/shared";

/** Lo que el usuario escribe en los filtros del histórico: las fechas son días locales (AAAA-MM-DD). */
export interface FiltrosDeHistorico {
  desde: string;
  hasta: string;
  tutorId: string;
  materiaId: string;
  estado: EstadoCita | "";
}

export const SIN_FILTROS: FiltrosDeHistorico = { desde: "", hasta: "", tutorId: "", materiaId: "", estado: "" };

export const ETIQUETA_ESTADO: Record<EstadoCita, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  CANCELADA: "Cancelada",
  FINALIZADA: "Finalizada",
};

export const ESTADOS_PARA_FILTRAR = ESTADOS_CITA;

/** Inicio del día local `fecha` (AAAA-MM-DD) como instante ISO, o null si no es una fecha válida. */
function inicioDelDia(fecha: string, diasDespues = 0): string | null {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  const instante = new Date(anio, mes - 1, dia + diasDespues);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString();
}

/** Problema de los filtros que se puede avisar antes de pedir nada al servidor; null si están bien. */
export function errorDeFiltros(filtros: FiltrosDeHistorico): string | null {
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    return "La fecha inicial debe ser anterior o igual a la final.";
  }
  return null;
}

/**
 * Cadena de consulta de la API para unos filtros. «Hasta» incluye todo ese día:
 * se envía el inicio del día siguiente, porque la API excluye el instante final.
 */
export function aConsulta(filtros: FiltrosDeHistorico, pagina?: { pagina: number; tamano: number }): string {
  const parametros = new URLSearchParams();
  const desde = filtros.desde ? inicioDelDia(filtros.desde) : null;
  const hasta = filtros.hasta ? inicioDelDia(filtros.hasta, 1) : null;

  if (desde) parametros.set("desde", desde);
  if (hasta) parametros.set("hasta", hasta);
  if (filtros.tutorId) parametros.set("tutorId", filtros.tutorId);
  if (filtros.materiaId) parametros.set("materiaId", filtros.materiaId);
  if (filtros.estado) parametros.set("estado", filtros.estado);
  if (pagina) {
    parametros.set("pagina", String(pagina.pagina));
    parametros.set("tamano", String(pagina.tamano));
  }
  return parametros.toString();
}

/** Cuántas páginas de `tamano` hay para `total` tutorías (al menos una, para poder mostrar «página 1 de 1»). */
export function totalDePaginas(total: number, tamano: number): number {
  return Math.max(1, Math.ceil(total / tamano));
}

/** Porcentaje de `parte` sobre `total` redondeado a entero; 0 si no hay total. */
export function porcentaje(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}
