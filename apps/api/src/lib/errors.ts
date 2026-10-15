/**
 * Error de una regla de negocio. Su mensaje está pensado para el usuario final
 * y el manejador central de errores lo responde con `statusCode`.
 */
export class ErrorDeNegocio extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 401 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "ErrorDeNegocio";
  }
}

/** 400: los datos enviados no cumplen una regla. */
export const solicitudInvalida = (mensaje: string) => new ErrorDeNegocio(mensaje, 400);

/** 401: no hay credenciales válidas. */
export const noAutenticado = (mensaje: string) => new ErrorDeNegocio(mensaje, 401);

/** 404: el recurso no existe o no pertenece a quien lo solicita. */
export const noEncontrado = (mensaje: string) => new ErrorDeNegocio(mensaje, 404);

/** 409: el estado actual del recurso no admite la operación. */
export const conflicto = (mensaje: string) => new ErrorDeNegocio(mensaje, 409);
