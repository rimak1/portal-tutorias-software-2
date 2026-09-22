import type { Rol } from "@portal-tutorias/shared";

const RUTA_POR_ROL: Record<Rol, string> = {
  ESTUDIANTE: "/estudiante",
  TUTOR: "/tutor",
  COORDINADOR: "/coordinador",
  ADMINISTRADOR: "/administrador",
};

export function rutaPanelPorRol(rol: Rol): string {
  return RUTA_POR_ROL[rol];
}
