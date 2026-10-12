/** Lo unico que el dominio necesita de un logger; el de Fastify (pino) lo cumple sin adaptadores. */
export interface Registro {
  info(datos: object, mensaje: string): void;
  error(datos: object, mensaje: string): void;
}
