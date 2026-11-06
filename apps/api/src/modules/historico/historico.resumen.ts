import { ESTADOS_CITA, type ResumenDeHistorico } from "@portal-tutorias/shared";
import type { CitaConRelaciones } from "../citas/citas.puertos.js";

const MS_POR_HORA = 3_600_000;

const masFrecuentePrimero = (a: { total: number }, b: { total: number }) => b.total - a.total;

/**
 * Totales de un conjunto de citas del histórico: por estado, por materia y por
 * tutor, y las horas de tutoría efectivamente realizadas (las Finalizadas).
 * Función pura: el servicio la aplica al conjunto completo que cumple los
 * filtros, no a la página que se muestra.
 */
export function resumirHistorico(citas: CitaConRelaciones[]): ResumenDeHistorico {
  const porEstado = Object.fromEntries(ESTADOS_CITA.map((estado) => [estado, 0])) as ResumenDeHistorico["porEstado"];
  const porMateria = new Map<string, number>();
  const porTutor = new Map<string, { nombre: string; total: number; finalizadas: number }>();
  let msFinalizados = 0;

  for (const cita of citas) {
    porEstado[cita.estado] += 1;
    porMateria.set(cita.franja.materia.nombre, (porMateria.get(cita.franja.materia.nombre) ?? 0) + 1);

    const tutor = porTutor.get(cita.franja.tutor.id) ?? { nombre: cita.franja.tutor.nombre, total: 0, finalizadas: 0 };
    tutor.total += 1;
    if (cita.estado === "FINALIZADA") {
      tutor.finalizadas += 1;
      msFinalizados += cita.franja.fechaFin.getTime() - cita.franja.fechaInicio.getTime();
    }
    porTutor.set(cita.franja.tutor.id, tutor);
  }

  return {
    total: citas.length,
    porEstado,
    horasFinalizadas: Math.round((msFinalizados / MS_POR_HORA) * 10) / 10,
    porMateria: [...porMateria].map(([materia, total]) => ({ materia, total })).sort(masFrecuentePrimero),
    porTutor: [...porTutor]
      .map(([id, { nombre, total, finalizadas }]) => ({ tutor: { id, nombre }, total, finalizadas }))
      .sort((a, b) => masFrecuentePrimero(a, b) || a.tutor.nombre.localeCompare(b.tutor.nombre, "es")),
  };
}
