import { z, type ZodType } from "zod";
import { noEncontrado, solicitudInvalida } from "./errors.js";

const MENSAJE_GENERICO = "Los datos enviados no son válidos.";
const uuidSchema = z.string().uuid();

/** Valida la entrada en la frontera del controlador; los mensajes por defecto de zod (en ingles) se reemplazan. */
export function validar<T>(esquema: ZodType<T>, datos: unknown): T {
  const resultado = esquema.safeParse(datos);
  if (resultado.success) {
    return resultado.data;
  }
  const mensaje = resultado.error.issues[0]?.message;
  const esMensajePorDefecto = !mensaje || /^(Required|Invalid|Expected|String must)/.test(mensaje);
  throw solicitudInvalida(esMensajePorDefecto ? MENSAJE_GENERICO : mensaje);
}

/** Un identificador de ruta que no es UUID se trata como recurso inexistente (evita un error de base de datos). */
export function exigirUuidDeRuta(valor: unknown, mensajeNoEncontrado: string): string {
  const resultado = uuidSchema.safeParse(valor);
  if (!resultado.success) {
    throw noEncontrado(mensajeNoEncontrado);
  }
  return resultado.data;
}
