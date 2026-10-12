import type { Disponibilidad, FranjaPropia } from "@portal-tutorias/shared";
import type { Reloj } from "../../lib/reloj.js";
import { aDisponibilidad, aFranjaPropia } from "./franjas.mapper.js";
import type { LecturaDeFranjas } from "./franjas.puertos.js";

/**
 * F-03: consulta de disponibilidad. Solo lee, asi que depende unicamente de la
 * interfaz de lectura de franjas, sin transacciones ni operaciones de escritura.
 */
export class ConsultaDeDisponibilidadService {
  constructor(
    private readonly franjas: LecturaDeFranjas,
    private readonly reloj: Reloj,
  ) {}

  /**
   * SWR-06 / SWR-07: franjas libres y vigentes de tutores activos, ordenadas por
   * fecha y hora, con filtro opcional por tutor y por materia.
   */
  async listarProximas(filtros: { tutorId?: string; materiaId?: string } = {}): Promise<Disponibilidad[]> {
    const franjas = await this.franjas.listarLibresProximas(filtros, this.reloj.ahora());
    return franjas.map(aDisponibilidad);
  }

  /** Agenda propia del tutor: franjas vigentes en cualquier estado. */
  async listarDeTutor(tutorId: string): Promise<FranjaPropia[]> {
    const franjas = await this.franjas.listarVigentesDeTutor(tutorId, this.reloj.ahora());
    return franjas.map(aFranjaPropia);
  }
}
