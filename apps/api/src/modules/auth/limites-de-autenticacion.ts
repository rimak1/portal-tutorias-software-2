import { DemasiadosIntentos } from "../../lib/errors.js";
import { LimitadorDeIntentos } from "../../lib/limitador-de-intentos.js";
import type { Reloj } from "../../lib/reloj.js";

export interface ConfiguracionDeLimites {
  /** Inicios de sesión fallidos desde una misma dirección IP, en la ventana. */
  fallosDeLoginPorIp: number;
  /** Inicios de sesión fallidos desde una misma IP contra un mismo correo, en la ventana. */
  fallosDeLoginPorCuenta: number;
  /** Solicitudes de recuperación de contraseña desde una misma IP, en la ventana. */
  recuperacionesPorIp: number;
  /** Solicitudes de recuperación para un mismo correo, en la ventana, vengan de donde vengan. */
  recuperacionesPorCuenta: number;
  ventanaMs: number;
}

export const LIMITES_POR_DEFECTO: ConfiguracionDeLimites = {
  fallosDeLoginPorIp: 20,
  fallosDeLoginPorCuenta: 5,
  recuperacionesPorIp: 10,
  recuperacionesPorCuenta: 3,
  ventanaMs: 15 * 60 * 1000,
};

/** Frenos a la fuerza bruta y al envío masivo de correos en las rutas públicas de autenticación. */
export interface LimitesDeAutenticacion {
  fallosDeLoginPorIp: LimitadorDeIntentos;
  fallosDeLoginPorCuenta: LimitadorDeIntentos;
  recuperacionPorIp: LimitadorDeIntentos;
  recuperacionPorCuenta: LimitadorDeIntentos;
}

export function crearLimites(configuracion: ConfiguracionDeLimites, reloj: Reloj): LimitesDeAutenticacion {
  const { ventanaMs } = configuracion;
  return {
    fallosDeLoginPorIp: new LimitadorDeIntentos(configuracion.fallosDeLoginPorIp, ventanaMs, reloj),
    fallosDeLoginPorCuenta: new LimitadorDeIntentos(configuracion.fallosDeLoginPorCuenta, ventanaMs, reloj),
    recuperacionPorIp: new LimitadorDeIntentos(configuracion.recuperacionesPorIp, ventanaMs, reloj),
    recuperacionPorCuenta: new LimitadorDeIntentos(configuracion.recuperacionesPorCuenta, ventanaMs, reloj),
  };
}

/** @throws DemasiadosIntentos (429) si `clave` agotó sus intentos en la ventana. */
export function exigirDisponible(limitador: LimitadorDeIntentos, clave: string): void {
  const esperaMs = limitador.esperaPara(clave);
  if (esperaMs > 0) {
    throw new DemasiadosIntentos(Math.ceil(esperaMs / 1000));
  }
}
