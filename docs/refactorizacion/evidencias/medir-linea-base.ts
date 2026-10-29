/**
 * Evidencia "antes" de los hallazgos H-01, H-02 y H-03 del diagnóstico.
 *
 * No modifica el código: arma los servicios reales (argon2 y JWT reales) con
 * los dobles en memoria de las pruebas y mide su comportamiento.
 *
 * Ejecutar desde la raíz del repositorio:
 *   npx tsx docs/refactorizacion/evidencias/medir-linea-base.ts
 */
import { hashPassword } from "../../../apps/api/src/lib/hash.js";
import type { Registro } from "../../../apps/api/src/lib/registro.js";
import { signResetToken } from "../../../apps/api/src/lib/token.js";
import { AuthService } from "../../../apps/api/src/modules/auth/auth.service.js";
import { cifradoArgon2 } from "../../../apps/api/src/modules/auth/cifrado-argon2.js";
import { RecuperacionDePasswordService } from "../../../apps/api/src/modules/auth/recuperacion-password.service.js";
import { crearTokensDeRestablecimiento, crearTokensDeSesion } from "../../../apps/api/src/modules/auth/tokens-jwt.js";
import type { EmailSender } from "../../../apps/api/src/modules/email/email-sender.js";
import { CuentasEnMemoria } from "../../../apps/api/test/fakes.js";

const CONFIG = {
  SESSION_SECRET: "secreto-de-sesion-para-pruebas-1234",
  SESSION_TTL_HORAS: 12,
  RESET_TOKEN_SECRET: "secreto-de-restablecimiento-pruebas-5678",
  RESET_TOKEN_TTL_MINUTOS: 30,
};
const REPETICIONES = 20;
/** Latencia simulada de un servidor SMTP real; el adaptador mock no tiene latencia. */
const LATENCIA_SMTP_MS = 300;

const registroMudo: Registro = { info: () => {}, error: () => {} };

async function medianaMs(accion: () => Promise<unknown>): Promise<number> {
  const tiempos: number[] = [];
  for (let i = 0; i < REPETICIONES; i++) {
    const inicio = performance.now();
    await accion().catch(() => {});
    tiempos.push(performance.now() - inicio);
  }
  tiempos.sort((a, b) => a - b);
  return tiempos[Math.floor(tiempos.length / 2)];
}

async function main(): Promise<void> {
  const passwordHash = await hashPassword("ClaveActual123");
  const cuentas = new CuentasEnMemoria([
    { id: "u-1", correo: "activa@uq.edu.co", nombre: "Activa", rol: "ESTUDIANTE", activo: true, passwordHash },
  ]);

  // H-02: login con correo registrado frente a correo inexistente (misma respuesta 401).
  const auth = new AuthService(cuentas, cifradoArgon2, crearTokensDeSesion(CONFIG));
  const loginExiste = await medianaMs(() => auth.login("activa@uq.edu.co", "ClaveIncorrecta"));
  const loginNoExiste = await medianaMs(() => auth.login("nadie@uq.edu.co", "ClaveIncorrecta"));
  console.log("H-02 login (mediana de %d intentos, ambos responden 401)", REPETICIONES);
  console.log("  correo registrado:   %s ms", loginExiste.toFixed(2));
  console.log("  correo inexistente:  %s ms", loginNoExiste.toFixed(2));

  // H-01: solicitud de recuperación con un proveedor de correo que tarda como SMTP.
  const correoLento: EmailSender = {
    enviarRecuperacionPassword: () => new Promise((resolver) => setTimeout(resolver, LATENCIA_SMTP_MS)),
  };
  const recuperacionLenta = new RecuperacionDePasswordService({
    cuentas,
    cifrado: cifradoArgon2,
    tokens: crearTokensDeRestablecimiento(CONFIG),
    correo: correoLento,
    registro: registroMudo,
    urlWeb: "http://localhost:5173",
  });
  const recuperarExiste = await medianaMs(() => recuperacionLenta.solicitar("activa@uq.edu.co"));
  const recuperarNoExiste = await medianaMs(() => recuperacionLenta.solicitar("nadie@uq.edu.co"));
  console.log("H-01 /auth/recuperar con SMTP simulado de %d ms (ambos responden { ok: true })", LATENCIA_SMTP_MS);
  console.log("  correo registrado:   %s ms", recuperarExiste.toFixed(2));
  console.log("  correo inexistente:  %s ms", recuperarNoExiste.toFixed(2));

  // H-03: dos restablecimientos simultáneos con el mismo enlace "de un solo uso".
  const token = signResetToken(CONFIG, "u-1", passwordHash);
  const recuperacion = new RecuperacionDePasswordService({
    cuentas,
    cifrado: cifradoArgon2,
    tokens: crearTokensDeRestablecimiento(CONFIG),
    correo: correoLento,
    registro: registroMudo,
    urlWeb: "http://localhost:5173",
  });
  const resultados = await Promise.allSettled([
    recuperacion.restablecer(token, "NuevaClaveA1"),
    recuperacion.restablecer(token, "NuevaClaveB2"),
  ]);
  const exitosos = resultados.filter((r) => r.status === "fulfilled").length;
  console.log("H-03 dos restablecimientos simultáneos con el mismo token");
  console.log("  exitosos: %d de 2 (lo esperado por RF-003 «un solo uso» es 1)", exitosos);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
