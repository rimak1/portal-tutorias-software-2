/** Abstraccion del tiempo: las reglas que dependen de "ahora" se prueban sin esperar ni falsear el reloj global. */
export interface Reloj {
  ahora(): Date;
}

export const relojDelSistema: Reloj = { ahora: () => new Date() };
