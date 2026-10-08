const formateadorFecha = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const formateadorHora = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
});

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

export function formatearFecha(iso: string): string {
  return capitalizar(formateadorFecha.format(new Date(iso)));
}

export function formatearHora(iso: string): string {
  return formateadorHora.format(new Date(iso));
}

export function formatearFranja(fechaInicio: string, fechaFin: string): string {
  return `${formatearFecha(fechaInicio)} · ${formatearHora(fechaInicio)} – ${formatearHora(fechaFin)}`;
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

/** Descompone un instante ISO en los valores que esperan <input type="date"> y <input type="time"> (hora local). */
export function aCamposLocales(iso: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  return {
    fecha: `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`,
    hora: `${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`,
  };
}

/** Une fecha y hora locales (de los inputs) en un instante ISO; devuelve null si alguno falta o es invalido. */
export function deCamposLocales(fecha: string, hora: string): string | null {
  if (!fecha || !hora) return null;
  const d = new Date(`${fecha}T${hora}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
