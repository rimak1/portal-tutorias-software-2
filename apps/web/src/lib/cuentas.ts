import { crearCuentaSchema, type CrearCuentaInput, type Cuenta, type Rol } from "@portal-tutorias/shared";

export const ETIQUETA_ROL: Record<Rol, string> = {
  ESTUDIANTE: "Estudiante",
  TUTOR: "Tutor",
  COORDINADOR: "Coordinador académico",
  ADMINISTRADOR: "Administrador",
};

export interface CamposDeCuenta {
  correo: string;
  nombre: string;
  rol: Rol;
  password: string;
}

export type ResultadoDeCuenta = { datos: CrearCuentaInput } | { error: string };

/** F-08: valida el formulario de una cuenta nueva con las mismas reglas que la API y explica el primer problema. */
export function construirCuenta(campos: CamposDeCuenta): ResultadoDeCuenta {
  const resultado = crearCuentaSchema.safeParse(campos);
  if (resultado.success) return { datos: resultado.data };
  return { error: resultado.error.issues[0]?.message ?? "Revisa los datos de la cuenta." };
}

export interface FiltroDeCuentas {
  texto: string;
  rol: Rol | "";
  estado: "activas" | "desactivadas" | "";
}

/** Cuentas que cumplen el filtro; el texto busca en el nombre y el correo, sin distinguir mayúsculas ni tildes. */
export function filtrarCuentas(cuentas: Cuenta[], filtro: FiltroDeCuentas): Cuenta[] {
  const buscado = normalizar(filtro.texto.trim());
  return cuentas.filter(
    (cuenta) =>
      (!filtro.rol || cuenta.rol === filtro.rol) &&
      (!filtro.estado || cuenta.activo === (filtro.estado === "activas")) &&
      (!buscado || normalizar(cuenta.nombre).includes(buscado) || normalizar(cuenta.correo).includes(buscado)),
  );
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const ALFABETO_DE_PASSWORD = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Contraseña inicial aleatoria de 12 caracteres, sin los que se confunden al
 * leerlos (0/O, 1/l/I). `aleatorios` se inyecta para poder probarla; por defecto
 * usa el generador criptográfico del navegador.
 */
export function generarPasswordInicial(aleatorios: (n: number) => Uint32Array = (n) => crypto.getRandomValues(new Uint32Array(n))): string {
  return Array.from(aleatorios(12), (valor) => ALFABETO_DE_PASSWORD[valor % ALFABETO_DE_PASSWORD.length]).join("");
}
