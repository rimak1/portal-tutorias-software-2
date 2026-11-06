const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Cuánto hace de un instante, en palabras cortas ("hace 5 min", "ayer"); pasado un mes, la fecha. */
export function tiempoRelativo(iso: string, ahora: Date = new Date()): string {
  const transcurrido = ahora.getTime() - new Date(iso).getTime();

  if (transcurrido < MINUTO) return "ahora";
  if (transcurrido < HORA) return `hace ${Math.floor(transcurrido / MINUTO)} min`;
  if (transcurrido < DIA) return `hace ${Math.floor(transcurrido / HORA)} h`;
  if (transcurrido < 2 * DIA) return "ayer";
  if (transcurrido < 30 * DIA) return `hace ${Math.floor(transcurrido / DIA)} días`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/** Número de la insignia de la campana: el contador exacto hasta 9 y "9+" desde 10. */
export function textoDeContador(noLeidas: number): string {
  return noLeidas > 9 ? "9+" : String(noLeidas);
}

/** Texto que leen los lectores de pantalla en el botón de la campana. */
export function etiquetaDeCampana(noLeidas: number): string {
  if (noLeidas === 0) return "Notificaciones, sin avisos nuevos";
  return `Notificaciones, ${noLeidas} ${noLeidas === 1 ? "aviso sin leer" : "avisos sin leer"}`;
}
