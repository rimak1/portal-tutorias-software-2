import { hashPassword, verifyPassword } from "../../lib/hash.js";
import type { CifradoDePasswords } from "./auth.puertos.js";

/** Cifrado de contraseñas con argon2id. */
export const cifradoArgon2: CifradoDePasswords = {
  cifrar: hashPassword,
  verificar: verifyPassword,
};
