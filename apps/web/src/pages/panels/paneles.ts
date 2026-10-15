import type { ComponentType } from "react";
import type { Rol } from "@portal-tutorias/shared";
import { AdministradorPanel } from "./AdministradorPanel";
import { CoordinadorPanel } from "./CoordinadorPanel";
import { EstudiantePanel } from "./EstudiantePanel";
import { TutorPanel } from "./TutorPanel";

/**
 * Panel de cada rol; App.tsx genera una ruta protegida por cada entrada. Para
 * un rol nuevo basta agregarlo aquí y en `rutas-por-rol.ts` (TypeScript exige
 * que ningún rol quede sin panel).
 */
export const PANELES: Record<Rol, ComponentType> = {
  ESTUDIANTE: EstudiantePanel,
  TUTOR: TutorPanel,
  COORDINADOR: CoordinadorPanel,
  ADMINISTRADOR: AdministradorPanel,
};
