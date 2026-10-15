import argon2 from "argon2";

/** Cifra una contraseña con argon2id (RNF-001: nunca se almacena en texto plano). */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/** Indica si `password` corresponde a `hash`. Un hash mal formado se trata como no coincidente. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
