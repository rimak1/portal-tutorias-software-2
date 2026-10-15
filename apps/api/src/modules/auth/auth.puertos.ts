/** Cifrado de contraseñas (RNF-001: nunca se almacenan en texto plano). */
export interface CifradoDePasswords {
  cifrar(password: string): Promise<string>;
  /** Devuelve false si la contraseña no corresponde o el hash está dañado; nunca lanza. */
  verificar(passwordHash: string, password: string): Promise<boolean>;
}

/** Tokens que viajan en la cookie de sesión. */
export interface TokensDeSesion {
  emitir(usuarioId: string): string;
  /** Id del usuario dueño del token, o null si el token es inválido o venció. */
  verificar(token: string): string | null;
}

export interface DatosDeRestablecimiento {
  usuarioId: string;
  /** Huella de la contraseña vigente cuando se emitió el token. */
  huellaDePassword: string;
}

/**
 * Tokens del enlace para restablecer la contraseña (RF-003). El token lleva la
 * huella de la contraseña vigente: cuando la contraseña cambia, la huella deja
 * de coincidir y el enlace queda usado, sin necesidad de guardarlo.
 */
export interface TokensDeRestablecimiento {
  emitir(usuarioId: string, passwordHash: string): string;
  /** Datos del token, o null si es inválido o venció. */
  verificar(token: string): DatosDeRestablecimiento | null;
  huellaDe(passwordHash: string): string;
}
