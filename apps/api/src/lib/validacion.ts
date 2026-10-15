import { z, type ZodType } from "zod";
import { noEncontrado, solicitudInvalida } from "./errors.js";

const MENSAJE_GENERICO = "Los datos enviados no son válidos.";
const uuidSchema = z.string().uuid();

/** Mensajes que zod genera por defecto (en inglés); nunca se muestran al usuario. */
const MENSAJE_POR_DEFECTO_DE_ZOD = /^(Required|Invalid|Expected|String must)/;

/**
 * Valida la entrada de una petición contra `esquema`.
 *
 * @param mensajePorDefecto Se usa cuando el esquema no define un mensaje propio para el error.
 * @returns Los datos validados y transformados por el esquema.
 * @throws ErrorDeNegocio 400 con el mensaje del primer error encontrado.
 */
export function validar<T>(esquema: ZodType<T>, datos: unknown, mensajePorDefecto = MENSAJE_GENERICO): T {
  const resultado = esquema.safeParse(datos);
  if (resultado.success) {
    return resultado.data;
  }
  const mensaje = resultado.error.issues[0]?.message;
  const esMensajeDeZod = !mensaje || MENSAJE_POR_DEFECTO_DE_ZOD.test(mensaje);
  throw solicitudInvalida(esMensajeDeZod ? mensajePorDefecto : mensaje);
}

/**
 * Valida el identificador de una ruta. Un valor que no es UUID se trata como
 * recurso inexistente, en lugar de dejar que la base de datos lo rechace.
 *
 * @throws ErrorDeNegocio 404 con `mensajeNoEncontrado`.
 */
export function exigirUuidDeRuta(valor: unknown, mensajeNoEncontrado: string): string {
  const resultado = uuidSchema.safeParse(valor);
  if (!resultado.success) {
    throw noEncontrado(mensajeNoEncontrado);
  }
  return resultado.data;
}
