/** Registro de eventos que usan los servicios. El logger de Fastify (pino) lo cumple directamente. */
export interface Registro {
  info(datos: object, mensaje: string): void;
  error(datos: object, mensaje: string): void;
}
