import type { Cita } from "@portal-tutorias/shared";

const ZONA_HORARIA = "America/Bogota";

/** El formato sueco es "2026-11-05 14:30": ordenable y sin ambigüedad de día y mes. */
const formatoDeFecha = new Intl.DateTimeFormat("sv-SE", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const ENCABEZADOS = ["Fecha", "Hora de inicio", "Hora de fin", "Materia", "Tutor", "Estudiante", "Estado", "Motivo del rechazo", "Finalizada el"];

/** Marca de orden de bytes: sin ella Excel abre el archivo UTF-8 con las tildes dañadas. */
const BOM = "﻿";

/**
 * Prepara un valor como celda CSV. Los nombres y motivos los escriben los
 * usuarios: una celda que empieza por `=`, `+`, `-` o `@` la interpretaría como
 * fórmula una hoja de cálculo, así que se antepone una comilla.
 */
export function celdaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

function partes(iso: string): { fecha: string; hora: string } {
  const [fecha, hora] = formatoDeFecha.format(new Date(iso)).split(" ");
  return { fecha, hora };
}

/** Histórico de tutorías como CSV (UTF-8 con marca de orden de bytes; horas de Colombia). */
export function historicoACsv(citas: Cita[]): string {
  const filas = citas.map((cita) => {
    const inicio = partes(cita.franja.fechaInicio);
    const fin = partes(cita.franja.fechaFin);
    const finalizada = cita.fechaFinalizacion ? formatoDeFecha.format(new Date(cita.fechaFinalizacion)) : "";
    return [inicio.fecha, inicio.hora, fin.hora, cita.materia, cita.tutor.nombre, cita.estudiante.nombre, cita.estado, cita.motivoRechazo ?? "", finalizada];
  });
  return BOM + [ENCABEZADOS, ...filas].map((fila) => fila.map(celdaCsv).join(",")).join("\r\n") + "\r\n";
}
