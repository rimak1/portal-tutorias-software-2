import type {
  ActualizarFranjaInput,
  CrearFranjaInput,
  Disponibilidad,
  EstadoFranja,
  FranjaPropia,
} from "@portal-tutorias/shared";
import type { Repositorios, UnidadDeTrabajo } from "../../db/unidad-de-trabajo.js";
import { conflicto, esViolacionDeTraslape, noEncontrado, solicitudInvalida } from "../../lib/errors.js";
import { aDisponibilidad, aFranjaPropia } from "./franjas.mapper.js";

const MENSAJE_TRASLAPE = "La franja se traslapa con otra de tu agenda.";
const MENSAJE_RESERVADA = "Esta franja ya está reservada: gestiona primero la cita asociada.";

/** F-02 y F-03: consulta de disponibilidad y gestion de franjas por el propio tutor. */
export class DisponibilidadService {
  constructor(private readonly uow: UnidadDeTrabajo) {}

  /**
   * SWR-06 / SWR-07: franjas libres y vigentes de tutores activos, ordenadas por
   * fecha y hora, con filtro opcional por tutor y por materia.
   */
  async listarProximas(filtros: { tutorId?: string; materiaId?: string } = {}): Promise<Disponibilidad[]> {
    const franjas = await this.uow.repos.franjas.listarLibresProximas(filtros);
    return franjas.map(aDisponibilidad);
  }

  /** Agenda propia del tutor: franjas vigentes en cualquier estado. */
  async listarDeTutor(tutorId: string): Promise<FranjaPropia[]> {
    const franjas = await this.uow.repos.franjas.listarVigentesDeTutor(tutorId);
    return franjas.map(aFranjaPropia);
  }

  /** SWR-03 y SWR-04: crea una franja con fecha, hora de inicio y de fin, sin traslapes. */
  async crear(tutorId: string, entrada: CrearFranjaInput): Promise<FranjaPropia> {
    const inicio = new Date(entrada.fechaInicio);
    const fin = new Date(entrada.fechaFin);
    this.validarHorario(inicio, fin);

    const repos = this.uow.repos;
    await this.exigirMateriaDelPerfil(repos, tutorId, entrada.materiaId);
    await this.exigirSinTraslape(repos, tutorId, inicio, fin);

    try {
      const franja = await repos.franjas.crear({ tutorId, materiaId: entrada.materiaId, fechaInicio: inicio, fechaFin: fin });
      return aFranjaPropia(franja);
    } catch (error) {
      // Dos solicitudes simultaneas pueden pasar la verificacion previa; la base de datos decide.
      if (esViolacionDeTraslape(error)) throw conflicto(MENSAJE_TRASLAPE);
      throw error;
    }
  }

  /** RN-003: solo se modifica una franja que no esta reservada. */
  async actualizar(tutorId: string, franjaId: string, cambios: ActualizarFranjaInput): Promise<FranjaPropia> {
    try {
      return await this.uow.ejecutar(async (repos) => {
        await this.bloquearFranjaLibreDelTutor(repos, tutorId, franjaId);

        const actual = await repos.franjas.cargar(franjaId);
        const inicio = cambios.fechaInicio ? new Date(cambios.fechaInicio) : actual.fechaInicio;
        const fin = cambios.fechaFin ? new Date(cambios.fechaFin) : actual.fechaFin;
        const materiaId = cambios.materiaId ?? actual.materiaId;

        this.validarHorario(inicio, fin);
        if (materiaId !== actual.materiaId) {
          await this.exigirMateriaDelPerfil(repos, tutorId, materiaId);
        }
        await this.exigirSinTraslape(repos, tutorId, inicio, fin, franjaId);

        return aFranjaPropia(await repos.franjas.actualizar(franjaId, { materiaId, fechaInicio: inicio, fechaFin: fin }));
      });
    } catch (error) {
      if (esViolacionDeTraslape(error)) throw conflicto(MENSAJE_TRASLAPE);
      throw error;
    }
  }

  /**
   * SWR-05: elimina una franja que aun no ha sido reservada. La eliminacion es
   * logica: las citas anteriores (rechazadas o canceladas) conservan su referencia.
   */
  async eliminar(tutorId: string, franjaId: string): Promise<void> {
    await this.uow.ejecutar(async (repos) => {
      await this.bloquearFranjaLibreDelTutor(repos, tutorId, franjaId);
      await repos.franjas.marcarEliminada(franjaId);
    });
  }

  private validarHorario(inicio: Date, fin: Date): void {
    if (fin <= inicio) {
      throw solicitudInvalida("La hora de fin debe ser posterior a la hora de inicio.");
    }
    if (inicio <= new Date()) {
      throw solicitudInvalida("La franja debe comenzar en el futuro.");
    }
  }

  private async exigirMateriaDelPerfil({ materias }: Repositorios, tutorId: string, materiaId: string): Promise<void> {
    if (!(await materias.tutorImparte(tutorId, materiaId))) {
      throw solicitudInvalida("Esa materia no está en tu perfil. Agrégala primero en «Mis materias».");
    }
  }

  private async exigirSinTraslape(
    { franjas }: Repositorios,
    tutorId: string,
    inicio: Date,
    fin: Date,
    ignorarFranjaId?: string,
  ): Promise<void> {
    if (await franjas.existeTraslape(tutorId, inicio, fin, ignorarFranjaId)) {
      throw conflicto(MENSAJE_TRASLAPE);
    }
  }

  /** Bloquea la franja propia para que no la reserven mientras se modifica o elimina; exige que siga libre. */
  private async bloquearFranjaLibreDelTutor({ franjas }: Repositorios, tutorId: string, franjaId: string): Promise<void> {
    const estado: EstadoFranja | null = await franjas.bloquearDelTutor(tutorId, franjaId);
    if (estado === null) {
      throw noEncontrado("La franja no existe.");
    }
    if (estado !== "LIBRE") {
      throw conflicto(MENSAJE_RESERVADA);
    }
  }
}
