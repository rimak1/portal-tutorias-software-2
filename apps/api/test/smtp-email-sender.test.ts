import { createServer, type Server } from "node:net";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { SmtpEmailSender } from "../src/modules/email/smtp-email-sender.js";

/**
 * El adaptador SMTP se prueba contra un servidor SMTP mínimo que habla lo justo del
 * protocolo: así una actualización de nodemailer que rompa el envío se nota aquí y no en producción.
 */

interface Recibido {
  remitente: string;
  destinatarios: string[];
  mensaje: string;
}

let servidor: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolver) => (servidor ? servidor.close(() => resolver()) : resolver()));
  servidor = undefined;
});

async function iniciarServidorSmtp(): Promise<{ puerto: number; recibidos: Recibido[] }> {
  const recibidos: Recibido[] = [];
  servidor = createServer((socket) => {
    let actual: Recibido = { remitente: "", destinatarios: [], mensaje: "" };
    let enDatos = false;
    let pendiente = "";
    socket.write("220 smtp.prueba ESMTP\r\n");
    socket.on("data", (trozo) => {
      pendiente += trozo.toString("utf8");
      const lineas = pendiente.split("\r\n");
      pendiente = lineas.pop() ?? "";
      for (const linea of lineas) {
        if (enDatos) {
          if (linea === ".") {
            enDatos = false;
            recibidos.push(actual);
            actual = { remitente: "", destinatarios: [], mensaje: "" };
            socket.write("250 2.0.0 Mensaje aceptado\r\n");
          } else {
            actual.mensaje += `${linea}\n`;
          }
          continue;
        }
        const orden = linea.toUpperCase();
        if (orden.startsWith("EHLO") || orden.startsWith("HELO")) socket.write("250 smtp.prueba\r\n");
        else if (orden.startsWith("MAIL FROM")) {
          actual.remitente = linea;
          socket.write("250 2.1.0 Ok\r\n");
        } else if (orden.startsWith("RCPT TO")) {
          actual.destinatarios.push(linea);
          socket.write("250 2.1.5 Ok\r\n");
        } else if (orden === "DATA") {
          enDatos = true;
          socket.write("354 Envia el mensaje\r\n");
        } else if (orden === "QUIT") {
          socket.end("221 2.0.0 Adios\r\n");
        } else socket.write("250 Ok\r\n");
      }
    });
  });
  await new Promise<void>((resolver) => servidor!.listen(0, "127.0.0.1", resolver));
  return { puerto: (servidor!.address() as AddressInfo).port, recibidos };
}

const configuracion = (puerto: number) => ({
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: puerto,
  SMTP_USER: undefined,
  SMTP_PASSWORD: undefined,
  SMTP_FROM: "Portal de Tutorias <no-responder@uq.edu.co>",
  RESET_TOKEN_TTL_MINUTOS: 30,
});

describe("SmtpEmailSender", () => {
  it("entrega el correo de recuperación al servidor SMTP, con el destinatario y el enlace", async () => {
    const { puerto, recibidos } = await iniciarServidorSmtp();

    await new SmtpEmailSender(configuracion(puerto)).enviarRecuperacionPassword("ana@uq.edu.co", "https://portal.example/restablecer");

    expect(recibidos).toHaveLength(1);
    expect(recibidos[0].remitente).toContain("no-responder@uq.edu.co");
    expect(recibidos[0].destinatarios).toEqual([expect.stringContaining("ana@uq.edu.co")]);
    expect(recibidos[0].mensaje).toContain("portal.example/restablecer");
    expect(recibidos[0].mensaje).toMatch(/^Subject: /m);
  });

  it("si el servidor SMTP no responde, el envío falla (quien llama decide qué hacer)", async () => {
    const { puerto } = await iniciarServidorSmtp();
    await new Promise<void>((resolver) => servidor!.close(() => resolver()));
    servidor = undefined;

    await expect(new SmtpEmailSender(configuracion(puerto)).enviarRecuperacionPassword("ana@uq.edu.co", "https://portal.example/r")).rejects.toThrow();
  });
});
