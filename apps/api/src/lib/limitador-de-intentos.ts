import type { Reloj } from "./reloj.js";

/** Pasada de limpieza: cada tantas consultas se descartan las claves que ya no tienen intentos vigentes. */
const CONSULTAS_ENTRE_LIMPIEZAS = 500;

/**
 * Limita cuántos intentos puede hacer una misma clave (una dirección IP, una
 * cuenta) dentro de una ventana de tiempo deslizante.
 *
 * Vive en la memoria del proceso: reiniciar la API lo reinicia, y varias
 * réplicas de la API llevarían cuentas separadas (el límite efectivo sería el
 * de una réplica multiplicado por el número de réplicas). Para un solo nodo,
 * que es el despliegue actual, basta y no añade dependencias.
 */
export class LimitadorDeIntentos {
  private readonly intentos = new Map<string, number[]>();
  private consultas = 0;

  constructor(
    private readonly maximo: number,
    private readonly ventanaMs: number,
    private readonly reloj: Reloj,
  ) {}

  /** Anota un intento de `clave`. */
  registrar(clave: string): void {
    const ahora = this.reloj.ahora().getTime();
    const vigentes = this.vigentes(clave, ahora);
    vigentes.push(ahora);
    this.intentos.set(clave, vigentes);
  }

  /** Milisegundos que `clave` debe esperar para volver a intentar; 0 si todavía puede. */
  esperaPara(clave: string): number {
    const ahora = this.reloj.ahora().getTime();
    this.limpiarDeVezEnCuando(ahora);
    const vigentes = this.vigentes(clave, ahora);
    if (vigentes.length < this.maximo) return 0;
    return vigentes[vigentes.length - this.maximo] + this.ventanaMs - ahora;
  }

  /** Olvida los intentos de `clave` (p. ej. tras un inicio de sesión correcto). */
  reiniciar(clave: string): void {
    this.intentos.delete(clave);
  }

  private vigentes(clave: string, ahora: number): number[] {
    return (this.intentos.get(clave) ?? []).filter((instante) => instante > ahora - this.ventanaMs);
  }

  private limpiarDeVezEnCuando(ahora: number): void {
    this.consultas += 1;
    if (this.consultas < CONSULTAS_ENTRE_LIMPIEZAS) return;
    this.consultas = 0;
    for (const [clave, instantes] of this.intentos) {
      if (!instantes.some((instante) => instante > ahora - this.ventanaMs)) this.intentos.delete(clave);
    }
  }
}
