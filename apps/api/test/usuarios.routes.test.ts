import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { PASSWORD, crearUsuario, env, iniciarSesion, limpiar, prisma } from "./helpers.js";

/**
 * F-08 (SWR-16). Pruebas de integración contra PostgreSQL real. Todas las
 * cuentas que se crean usan el prefijo del archivo para poder borrarlas al final.
 */

const P = "usr";
type Cookies = Record<string, string>;
interface CuentaJson {
  id: string;
  correo: string;
  nombre: string;
  rol: string;
  activo: boolean;
  creadoEn: string;
  passwordHash?: string;
}

let app: FastifyInstance;
let admin: { id: string; correo: string };
let cookiesAdmin: Cookies;
let cookiesCoordinador: Cookies;
let cookiesTutor: Cookies;
let cookiesEstudiante: Cookies;

beforeAll(async () => {
  app = await buildApp(env);
  await app.ready();
  await limpiar(P);

  admin = await crearUsuario(P, "Administrador", "ADMINISTRADOR");
  const coordinador = await crearUsuario(P, "Coordinador", "COORDINADOR");
  const tutor = await crearUsuario(P, "Tutor", "TUTOR");
  const estudiante = await crearUsuario(P, "Estudiante", "ESTUDIANTE");
  cookiesAdmin = await iniciarSesion(app, admin.correo);
  cookiesCoordinador = await iniciarSesion(app, coordinador.correo);
  cookiesTutor = await iniciarSesion(app, tutor.correo);
  cookiesEstudiante = await iniciarSesion(app, estudiante.correo);
});

afterAll(async () => {
  await limpiar(P);
  await prisma.$disconnect();
  await app.close();
});

const correoNuevo = (nombre: string) => `${P}.${nombre}@test.uniquindio.edu.co`;
const crear = (cookies: Cookies, payload: object) => app.inject({ method: "POST", url: "/api/usuarios", cookies, payload });
const editar = (cookies: Cookies, id: string, payload: object) => app.inject({ method: "PATCH", url: `/api/usuarios/${id}`, cookies, payload });
const listar = (cookies: Cookies, consulta = "") => app.inject({ method: "GET", url: `/api/usuarios${consulta}`, cookies });
const PASSWORD_INICIAL = "ClaveInicial123";

/** Inicio de sesión con la contraseña que se definió al crear la cuenta (no la de las cuentas de prueba). */
async function iniciarSesionCon(correo: string, password: string): Promise<Cookies> {
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { correo, password } });
  expect(login.statusCode).toBe(200);
  const cookie = login.cookies.find((c) => c.name === env.SESSION_COOKIE_NAME)!;
  return { [cookie.name]: cookie.value };
}

const datosDeCuenta = (nombre: string, rol = "TUTOR") => ({ correo: correoNuevo(nombre), nombre: `Persona ${nombre}`, rol, password: PASSWORD_INICIAL });

async function crearCuenta(nombre: string, rol = "TUTOR"): Promise<CuentaJson> {
  const respuesta = await crear(cookiesAdmin, datosDeCuenta(nombre, rol));
  expect(respuesta.statusCode).toBe(201);
  return respuesta.json().cuenta;
}

describe("SWR-16: el administrador crea cuentas", () => {
  it("crea una cuenta de cualquier rol, sin exponer la contraseña, y la persona puede iniciar sesión con ella", async () => {
    for (const rol of ["ESTUDIANTE", "TUTOR", "COORDINADOR", "ADMINISTRADOR"]) {
      const respuesta = await crear(cookiesAdmin, datosDeCuenta(`rol-${rol.toLowerCase()}`, rol));

      expect(respuesta.statusCode).toBe(201);
      const { cuenta } = respuesta.json();
      expect(cuenta).toMatchObject({ rol, activo: true, correo: correoNuevo(`rol-${rol.toLowerCase()}`) });
      expect(JSON.stringify(respuesta.json())).not.toMatch(/password|hash/i);
    }

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { correo: correoNuevo("rol-tutor"), password: PASSWORD_INICIAL },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().usuario.rol).toBe("TUTOR");
  });

  it("guarda la contraseña cifrada y registra quién creó la cuenta", async () => {
    const cuenta = await crearCuenta("trazabilidad");

    const enBase = await prisma.usuario.findUniqueOrThrow({ where: { id: cuenta.id } });
    expect(enBase.passwordHash).not.toContain(PASSWORD_INICIAL);
    expect(enBase.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(enBase.creadoPorId).toBe(admin.id);
  });

  it("guarda el correo en minúsculas y no admite dos cuentas que difieran solo por mayúsculas", async () => {
    const datos = datosDeCuenta("mayusculas");
    const primera = await crear(cookiesAdmin, { ...datos, correo: datos.correo.toUpperCase() });
    expect(primera.statusCode).toBe(201);
    expect(primera.json().cuenta.correo).toBe(datos.correo);

    const repetida = await crear(cookiesAdmin, datos);
    expect(repetida.statusCode).toBe(409);
    expect(repetida.json().message).toBe("Ya existe una cuenta con ese correo.");
  });

  it("valida los datos: correo, nombre, rol y contraseña", async () => {
    const base = datosDeCuenta("invalida");
    const casos: Array<[object, string]> = [
      [{ ...base, correo: "no-es-correo" }, "Ingresa un correo válido."],
      [{ ...base, nombre: "A" }, "El nombre debe tener al menos 2 caracteres."],
      [{ ...base, password: "corta" }, "La contraseña debe tener al menos 8 caracteres."],
      [{ ...base, rol: "SUPERUSUARIO" }, "Selecciona un rol válido."],
      [{ correo: base.correo }, "Los datos de la cuenta no son válidos."],
    ];

    for (const [payload, mensaje] of casos) {
      const respuesta = await crear(cookiesAdmin, payload);
      expect(respuesta.statusCode, JSON.stringify(payload)).toBe(400);
      expect(respuesta.json().message).toBe(mensaje);
    }
    expect(await prisma.usuario.count({ where: { correo: base.correo } })).toBe(0);
  });
});

describe("RN-001: quién puede administrar cuentas", () => {
  it("el coordinador registra tutores pero no otros roles", async () => {
    const tutor = await crear(cookiesCoordinador, datosDeCuenta("coord-tutor", "TUTOR"));
    expect(tutor.statusCode).toBe(201);

    for (const rol of ["ESTUDIANTE", "COORDINADOR", "ADMINISTRADOR"]) {
      const respuesta = await crear(cookiesCoordinador, datosDeCuenta(`coord-${rol.toLowerCase()}`, rol));
      expect(respuesta.statusCode, rol).toBe(403);
    }
    expect(await prisma.usuario.count({ where: { correo: correoNuevo("coord-administrador") } })).toBe(0);
  });

  it("el coordinador solo lista tutores", async () => {
    const respuesta = await listar(cookiesCoordinador, "?rol=ADMINISTRADOR");

    expect(respuesta.statusCode).toBe(200);
    const roles = new Set((respuesta.json().cuentas as CuentaJson[]).map((c) => c.rol));
    expect([...roles]).toEqual(["TUTOR"]);
  });

  it("el coordinador no puede editar ni desactivar cuentas", async () => {
    const cuenta = await crearCuenta("intocable");

    expect((await editar(cookiesCoordinador, cuenta.id, { activo: false })).statusCode).toBe(403);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: cuenta.id } })).activo).toBe(true);
  });

  it("estudiantes y tutores no tienen acceso a la administración; sin sesión, 401", async () => {
    for (const cookies of [cookiesEstudiante, cookiesTutor]) {
      expect((await listar(cookies)).statusCode).toBe(403);
      expect((await crear(cookies, datosDeCuenta("sin-permiso"))).statusCode).toBe(403);
      expect((await editar(cookies, admin.id, { nombre: "Hackeado" })).statusCode).toBe(403);
    }
    expect((await app.inject({ method: "GET", url: "/api/usuarios" })).statusCode).toBe(401);
    expect(await prisma.usuario.count({ where: { correo: correoNuevo("sin-permiso") } })).toBe(0);
  });
});

describe("SWR-16: el administrador consulta cuentas", () => {
  it("lista las cuentas ordenadas por nombre sin exponer contraseñas, y filtra por rol, estado y texto", async () => {
    const cuenta = await crearCuenta("filtrable");
    await editar(cookiesAdmin, cuenta.id, { activo: false });

    const todas = (await listar(cookiesAdmin, `?q=${P}.`)).json().cuentas as CuentaJson[];
    expect(todas.length).toBeGreaterThanOrEqual(5);
    expect(todas.map((c) => c.nombre)).toEqual([...todas.map((c) => c.nombre)].sort((a, b) => a.localeCompare(b)));
    expect(todas.every((c) => c.passwordHash === undefined)).toBe(true);

    const inactivas = (await listar(cookiesAdmin, `?activo=false&q=${P}.`)).json().cuentas as CuentaJson[];
    expect(inactivas.map((c) => c.id)).toContain(cuenta.id);
    expect(inactivas.every((c) => !c.activo)).toBe(true);

    const porNombre = (await listar(cookiesAdmin, "?q=PERSONA%20FILTRABLE")).json().cuentas as CuentaJson[];
    expect(porNombre.map((c) => c.id)).toEqual([cuenta.id]);

    const administradores = (await listar(cookiesAdmin, `?rol=ADMINISTRADOR&q=${P}.`)).json().cuentas as CuentaJson[];
    expect(administradores.every((c) => c.rol === "ADMINISTRADOR")).toBe(true);
  });

  it("rechaza filtros inválidos", async () => {
    expect((await listar(cookiesAdmin, "?rol=ROL_FALSO")).statusCode).toBe(400);
    expect((await listar(cookiesAdmin, "?activo=quizas")).statusCode).toBe(400);
  });
});

describe("SWR-16: el administrador edita y desactiva cuentas", () => {
  it("cambia el nombre de una cuenta", async () => {
    const cuenta = await crearCuenta("renombrar");

    const respuesta = await editar(cookiesAdmin, cuenta.id, { nombre: "Nombre Corregido" });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().cuenta.nombre).toBe("Nombre Corregido");
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: cuenta.id } })).nombre).toBe("Nombre Corregido");
  });

  it("una cuenta desactivada pierde el acceso de inmediato, aunque su sesión siga vigente, y se puede reactivar", async () => {
    const cuenta = await crearCuenta("desactivable");
    const cookies = await iniciarSesionCon(cuenta.correo, PASSWORD_INICIAL);
    expect((await app.inject({ method: "GET", url: "/api/auth/sesion", cookies })).statusCode).toBe(200);

    expect((await editar(cookiesAdmin, cuenta.id, { activo: false })).json().cuenta.activo).toBe(false);

    expect((await app.inject({ method: "GET", url: "/api/auth/sesion", cookies })).statusCode).toBe(401);
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { correo: cuenta.correo, password: PASSWORD_INICIAL } });
    expect(login.statusCode).toBe(401);

    await editar(cookiesAdmin, cuenta.id, { activo: true });
    expect((await app.inject({ method: "GET", url: "/api/auth/sesion", cookies })).statusCode).toBe(200);
  });

  it("restablece la contraseña: la anterior deja de servir y la nueva funciona", async () => {
    const cuenta = await crearCuenta("clave");

    expect((await editar(cookiesAdmin, cuenta.id, { password: "ClaveNueva456" })).statusCode).toBe(200);

    const vieja = await app.inject({ method: "POST", url: "/api/auth/login", payload: { correo: cuenta.correo, password: PASSWORD_INICIAL } });
    const nueva = await app.inject({ method: "POST", url: "/api/auth/login", payload: { correo: cuenta.correo, password: "ClaveNueva456" } });
    expect(vieja.statusCode).toBe(401);
    expect(nueva.statusCode).toBe(200);
  });

  it("no permite cambiar el rol ni otros datos de la cuenta", async () => {
    const cuenta = await crearCuenta("sin-cambio-de-rol");

    for (const payload of [{ rol: "ADMINISTRADOR" }, { correo: "otro@uq.edu.co" }, { passwordHash: "x" }]) {
      const respuesta = await editar(cookiesAdmin, cuenta.id, payload);
      expect(respuesta.statusCode, JSON.stringify(payload)).toBe(400);
    }
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: cuenta.id } })).rol).toBe("TUTOR");
  });

  it("rechaza una edición vacía o con datos inválidos", async () => {
    const cuenta = await crearCuenta("edicion-invalida");

    expect((await editar(cookiesAdmin, cuenta.id, {})).json().message).toBe("No hay cambios para guardar.");
    expect((await editar(cookiesAdmin, cuenta.id, { nombre: "X" })).statusCode).toBe(400);
    expect((await editar(cookiesAdmin, cuenta.id, { password: "corta" })).statusCode).toBe(400);
    expect((await editar(cookiesAdmin, cuenta.id, { activo: "no" })).statusCode).toBe(400);
  });

  it("una cuenta inexistente o un identificador mal formado es un 404", async () => {
    expect((await editar(cookiesAdmin, "00000000-0000-4000-8000-000000000000", { activo: false })).statusCode).toBe(404);
    expect((await editar(cookiesAdmin, "no-es-uuid", { activo: false })).statusCode).toBe(404);
  });

  it("el administrador no puede desactivar su propia cuenta", async () => {
    const respuesta = await editar(cookiesAdmin, admin.id, { activo: false });

    expect(respuesta.statusCode).toBe(409);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } })).activo).toBe(true);
    expect((await app.inject({ method: "GET", url: "/api/auth/sesion", cookies: cookiesAdmin })).statusCode).toBe(200);
  });

  it("puede cambiar su propio nombre y contraseña", async () => {
    const yo = await crearCuenta("admin-propio", "ADMINISTRADOR");
    const cookies = await iniciarSesionCon(yo.correo, PASSWORD_INICIAL);

    const respuesta = await editar(cookies, yo.id, { nombre: "Mi Nuevo Nombre", password: PASSWORD + "x" });

    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json().cuenta.nombre).toBe("Mi Nuevo Nombre");
  });
});
