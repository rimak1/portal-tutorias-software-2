import type { Disponibilidad, FranjaPropia } from "@portal-tutorias/shared";
import type { Reloj } from "../../lib/reloj.js";
import { aDisponibilidad, aFranjaPropia } from "./franjas.mapper.js";
import type { LecturaDeFranjas } from "./franjas.puertos.js";

/** F-03: consulta de las franjas disponibles y de la agenda propia del tutor. */
export class ConsultaDeDisponibilidadService {
  constructor(
    private readonly franjas: LecturaDeFranjas,
    private readonly reloj: Reloj,
  ) {}

  /**
   * SWR-06 y SWR-07: franjas libres que aún no comienzan, de tutores activos,
   * ordenadas por fecha y hora, con filtro opcional por tutor y por materia.
   */
  async listarProximas(filtros: { tutorId?: string; materiaId?: string } = {}): Promise<Disponibilidad[]> {
    const franjas = await this.franjas.listarLibresProximas(filtros, this.reloj.ahora());
    return franjas.map(aDisponibilidad);
  }

  /** Agenda propia del tutor: franjas que aún no terminan, libres o reservadas. */
  async listarDeTutor(tutorId: string): Promise<FranjaPropia[]> {
    const franjas = await this.franjas.listarVigentesDeTutor(tutorId, this.reloj.ahora());
    return franjas.map(aFranjaPropia);
  }
}
