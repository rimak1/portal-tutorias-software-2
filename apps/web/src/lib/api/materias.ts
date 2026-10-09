import type { Materia } from "@portal-tutorias/shared";
import { apiClient } from "../api-client";

/** Fachada de las materias: los componentes no conocen rutas ni la forma de las respuestas. */
export const materiasApi = {
  listarCatalogo: () => apiClient.get<{ materias: Materia[] }>("/materias").then((r) => r.materias),
  listarMias: () => apiClient.get<{ materias: Materia[] }>("/tutores/yo/materias").then((r) => r.materias),
  guardarMias: (materiaIds: string[]) =>
    apiClient.put<{ materias: Materia[] }>("/tutores/yo/materias", { materiaIds }).then((r) => r.materias),
};
