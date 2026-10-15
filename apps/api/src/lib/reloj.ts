/** Fuente de la hora actual. Las pruebas usan un reloj fijo para las reglas que dependen de "ahora". */
export interface Reloj {
  ahora(): Date;
}

export const relojDelSistema: Reloj = { ahora: () => new Date() };
