export const ROLES = ["ESTUDIANTE", "TUTOR", "ADMINISTRADOR", "COORDINADOR"] as const;

export type Rol = (typeof ROLES)[number];
