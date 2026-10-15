import { beforeAll, describe, expect, it, vi } from "vitest";
import { ErrorDeNegocio } from "../src/lib/errors.js";
import { hashPassword, verifyPassword } from "../src/lib/hash.js";
import type { Registro } from "../src/lib/registro.js";
import { signResetToken, type ConfigDeRestablecimiento, type ConfigDeSesion } from "../src/lib/token.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { cifradoArgon2 } from "../src/modules/auth/cifrado-argon2.js";
import { RecuperacionDePasswordService } from "../src/modules/auth/recuperacion-password.service.js";
import { crearTokensDeRestablecimiento, crearTokensDeSesion } from "../src/modules/auth/tokens-jwt.js";
import type { EmailSender } from "../src/modules/email/email-sender.js";
import type { Cuenta } from "../src/modules/usuarios/usuarios.puertos.js";
import { CuentasEnMemoria } from "./fakes.js";

const CONFIG = {
  SESSION_SECRET: "secreto-de-sesion-para-pruebas-1234",
  SESSION_TTL_HORAS: 12,
  RESET_TOKEN_SECRET: "secreto-de-restablecimiento-pruebas-5678",
  RESET_TOKEN_TTL_MINUTOS: 30,
} satisfies ConfigDeSesion & ConfigDeRestablecimiento;

const URL_WEB = "http://localhost:5173";

const authCon = (cuentasDePrueba: CuentasEnMemoria) =>
  new AuthService(cuentasDePrueba, cifradoArgon2, crearTokensDeSesion(CONFIG));

const recuperacionCon = (cuentasDePrueba: CuentasEnMemoria, correo: EmailSender, registro: Registro) =>
  new RecuperacionDePasswordService({
    cuentas: cuentasDePrueba,
    cifrado: cifradoArgon2,
    tokens: crearTokensDeRestablecimiento(CONFIG),
    correo,
    registro,
    urlWeb: URL_WEB,
  });

let activa: Cuenta;
let desactivada: Cuenta;
let cuentas: CuentasEnMemoria;

beforeAll(async () => {
  const passwordHash = await hashPassword("ClaveActual123");
  activa = { id: "u-1", correo: "activa@uq.edu.co", nombre: "Activa", rol: "ESTUDIANTE", activo: true, passwordHash };
  desactivada = { id: "u-2", correo: "inactiva@uq.edu.co", nombre: "Inactiva", rol: "TUTOR", activo: false, passwordHash };
  cuentas = new CuentasEnMemoria([activa, desactivada]);
});

const mensajeDe = async (promesa: Promise<unknown>) => {
  const error = await promesa.then(
    () => null,
    (e) => e,
  );
  expect(error).toBeInstanceOf(ErrorDeNegocio);
  return { status: (error as ErrorDeNegocio).statusCode, mensaje: (error as ErrorDeNegocio).message };
};

describe("AuthService.login (SWR-01)", () => {
  it("emite el token y devuelve el rol de la cuenta", async () => {
    const resultado = await authCon(cuentas).login("activa@uq.edu.co", "ClaveActual123");

    expect(resultado.token.length).toBeGreaterThan(20);
    expect(resultado.usuario).toEqual({ id: "u-1", correo: "activa@uq.edu.co", nombre: "Activa", rol: "ESTUDIANTE" });
  });

  it("correo inexistente, contrasena incorrecta y cuenta desactivada responden exactamente lo mismo", async () => {
    const auth = authCon(cuentas);

    const inexistente = await mensajeDe(auth.login("nadie@uq.edu.co", "ClaveActual123"));
    const incorrecta = await mensajeDe(auth.login("activa@uq.edu.co", "otra"));
    const inactiva = await mensajeDe(auth.login("inactiva@uq.edu.co", "ClaveActual123"));

    expect(inexistente).toEqual({ status: 401, mensaje: "Correo o contraseña incorrectos." });
    expect(incorrecta).toEqual(inexistente);
    expect(inactiva).toEqual(inexistente);
  });
});

describe("RecuperacionDePasswordService (SWR-18)", () => {
  const registro = (): Registro & { error: ReturnType<typeof vi.fn> } => ({ info: vi.fn(), error: vi.fn() });
  const emisor = () => {
    const enviados: Array<{ destinatario: string; enlace: string }> = [];
    const sender: EmailSender = {
      async enviarRecuperacionPassword(destinatario, enlace) {
        enviados.push({ destinatario, enlace });
      },
    };
    return { enviados, sender };
  };

  it("envia el enlace a una cuenta activa y no a una inexistente o desactivada", async () => {
    const { enviados, sender } = emisor();
    const servicio = recuperacionCon(cuentas, sender, registro());

    await servicio.solicitar("activa@uq.edu.co");
    await servicio.solicitar("inactiva@uq.edu.co");
    await servicio.solicitar("nadie@uq.edu.co");

    expect(enviados).toHaveLength(1);
    expect(enviados[0].destinatario).toBe("activa@uq.edu.co");
    expect(enviados[0].enlace).toContain("http://localhost:5173/restablecer-password?token=");
  });

  describe("cualquier EmailSender es intercambiable sin cambiar lo que observa quien pide el enlace", () => {
    const quePasaCon = async (sender: EmailSender, correo: string) => {
      const log = registro();
      const resultado = await recuperacionCon(cuentas, sender, log).solicitar(correo).then(
        () => "resuelve",
        (e) => `lanza ${(e as Error).message}`,
      );
      return { resultado, errores: log.error.mock.calls.length };
    };

    const caido: EmailSender = {
      async enviarRecuperacionPassword() {
        throw new Error("SMTP no disponible");
      },
    };

    it("un proveedor caido no hace fallar la solicitud: se registra el error y el resultado es igual al de un correo inexistente", async () => {
      const conProveedorCaido = await quePasaCon(caido, "activa@uq.edu.co");
      const correoInexistente = await quePasaCon(caido, "nadie@uq.edu.co");

      expect(conProveedorCaido.resultado).toBe("resuelve");
      expect(conProveedorCaido.resultado).toBe(correoInexistente.resultado);
      expect(conProveedorCaido.errores).toBe(1);
      expect(correoInexistente.errores).toBe(0);
    });
  });

  describe("restablecer", () => {
    const servicio = () => recuperacionCon(cuentas, { enviarRecuperacionPassword: async () => {} }, registro());

    it("con un token valido define la nueva contrasena", async () => {
      const cuenta: Cuenta = { ...activa, id: "u-3", correo: "otra@uq.edu.co" };
      const propias = new CuentasEnMemoria([cuenta]);
      const token = signResetToken(CONFIG, cuenta.id, cuenta.passwordHash);

      await recuperacionCon(propias, { enviarRecuperacionPassword: async () => {} }, registro()).restablecer(token, "NuevaClave456");

      expect(await verifyPassword(cuenta.passwordHash, "NuevaClave456")).toBe(true);
    });

    it("un token manipulado o de una cuenta desactivada se rechaza con 400", async () => {
      expect((await mensajeDe(servicio().restablecer("token-falso", "NuevaClave456"))).status).toBe(400);
      const tokenDeInactiva = signResetToken(CONFIG, desactivada.id, desactivada.passwordHash);
      expect((await mensajeDe(servicio().restablecer(tokenDeInactiva, "NuevaClave456"))).status).toBe(400);
    });

    it("el enlace es de un solo uso", async () => {
      const cuenta: Cuenta = { ...activa, id: "u-4", correo: "uso@uq.edu.co" };
      const propias = new CuentasEnMemoria([cuenta]);
      const token = signResetToken(CONFIG, cuenta.id, cuenta.passwordHash);
      const s = recuperacionCon(propias, { enviarRecuperacionPassword: async () => {} }, registro());

      await s.restablecer(token, "NuevaClave456");

      expect(await mensajeDe(s.restablecer(token, "TerceraClave789"))).toEqual({ status: 400, mensaje: "El enlace ya fue utilizado." });
    });
  });
});
