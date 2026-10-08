/** Error de regla de negocio: Fastify lo traduce a la respuesta HTTP indicada por statusCode. */
export class ErrorDeNegocio extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409,
  ) {
    super(message);
  }
}

export const solicitudInvalida = (mensaje: string) => new ErrorDeNegocio(mensaje, 400);
export const noEncontrado = (mensaje: string) => new ErrorDeNegocio(mensaje, 404);
export const conflicto = (mensaje: string) => new ErrorDeNegocio(mensaje, 409);

function textoDelError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** SWR-04: la base de datos rechazo la franja por la restriccion de exclusion de traslapes. */
export function esViolacionDeTraslape(error: unknown): boolean {
  const texto = textoDelError(error);
  return texto.includes("disponibilidad_sin_traslape") || texto.includes("23P01");
}

/** SWR-09: el indice unico parcial rechazo una segunda cita activa sobre la misma franja. */
export function esViolacionDeUnicidad(error: unknown): boolean {
  const codigo = (error as { code?: string } | null)?.code;
  const texto = textoDelError(error);
  return codigo === "P2002" || texto.includes("cita_franja_activa_key") || texto.includes("23505");
}
