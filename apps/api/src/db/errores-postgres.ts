/**
 * Reconoce las violaciones de restricciones de PostgreSQL tal como las reporta
 * Prisma. Solo lo usan los repositorios, que las traducen a errores de negocio:
 * los servicios nunca reciben errores de la base de datos.
 */

const CODIGO_EXCLUSION = "23P01";
const CODIGO_UNICIDAD = "23505";
const CODIGO_UNICIDAD_PRISMA = "P2002";

function textoDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Indica si `error` proviene de violar la restricción de exclusión `restriccion`. */
export function violaExclusion(error: unknown, restriccion: string): boolean {
  const texto = textoDe(error);
  return texto.includes(restriccion) || texto.includes(CODIGO_EXCLUSION);
}

/** Indica si `error` proviene de violar el índice único `indice`. */
export function violaUnicidad(error: unknown, indice: string): boolean {
  const codigo = (error as { code?: string } | null)?.code;
  const texto = textoDe(error);
  return codigo === CODIGO_UNICIDAD_PRISMA || texto.includes(indice) || texto.includes(CODIGO_UNICIDAD);
}
