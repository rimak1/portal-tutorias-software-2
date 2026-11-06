import { describe, expect, it } from "vitest";
import type { Env } from "../src/config/env.js";
import { crearEmailSender } from "../src/modules/email/email-sender.factory.js";
import { env } from "./helpers.js";

/** El adaptador simulado escribe en el registro lo que no envía; el enlace solo debe aparecer fuera de producción. */
function registroQueGuarda() {
  const lineas: Array<Record<string, unknown>> = [];
  const registro = { info: (datos: Record<string, unknown>) => void lineas.push(datos) };
  return { registro: registro as unknown as Parameters<typeof crearEmailSender>[1], lineas };
}

const ENLACE = "https://portal.example/restablecer-password?token=secreto";

describe("adaptador de correo simulado", () => {
  it("fuera de producción registra el destinatario y el enlace, para poder probar el flujo", async () => {
    const { registro, lineas } = registroQueGuarda();

    await crearEmailSender({ ...env, EMAIL_ADAPTER: "mock", NODE_ENV: "development" } as Env, registro).enviarRecuperacionPassword("a@uq.edu.co", ENLACE);

    expect(lineas).toEqual([{ destinatario: "a@uq.edu.co", enlace: ENLACE }]);
  });

  it("en producción no deja el enlace de restablecimiento en los registros", async () => {
    const { registro, lineas } = registroQueGuarda();

    await crearEmailSender({ ...env, EMAIL_ADAPTER: "mock", NODE_ENV: "production" } as Env, registro).enviarRecuperacionPassword("a@uq.edu.co", ENLACE);

    expect(lineas).toEqual([{ destinatario: "a@uq.edu.co" }]);
    expect(JSON.stringify(lineas)).not.toContain("secreto");
  });
});
