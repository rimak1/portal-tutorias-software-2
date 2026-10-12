import type { ComponentType } from "react";
import type { Rol } from "@portal-tutorias/shared";
import { AdministradorPanel } from "./AdministradorPanel";
import { CoordinadorPanel } from "./CoordinadorPanel";
import { EstudiantePanel } from "./EstudiantePanel";
import { TutorPanel } from "./TutorPanel";

/**
 * Registro de paneles por rol (OCP): las rutas se generan a partir de el, asi
 * que un rol nuevo se agrega aqui y en `rutas-por-rol.ts` sin tocar App.tsx.
 * Al ser un Record<Rol, ...>, TypeScript obliga a registrar un panel por cada rol.
 */
export const PANELES: Record<Rol, ComponentType> = {
  ESTUDIANTE: EstudiantePanel,
  TUTOR: TutorPanel,
  COORDINADOR: CoordinadorPanel,
  ADMINISTRADOR: AdministradorPanel,
};
