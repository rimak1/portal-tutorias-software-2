import type { ActualizarFranjaInput, CrearFranjaInput, FranjaPropia } from "@portal-tutorias/shared";
import type { Repositorios, UnidadDeTrabajo } from "../../db/puertos.js";
import { conflicto, esViolacionDeTraslape, noEncontrado, solicitudInvalida } from "../../lib/errors.js";
import type { Reloj } from "../../lib/reloj.js";
import { validarHorario } from "./franja.reglas.js";
import { aFranjaPropia } from "./franjas.mapper.js";

const MENSAJE_TRASLAPE = "La franja se traslapa con otra de tu agenda.";
const MENSAJE_RESERVADA = "Esta franja ya está reservada: gestiona primero la cita asociada.";

/** F-02: el tutor crea, modifica y elimina sus franjas (SWR-03, SWR-04 y SWR-05). */
export class GestionDeFranjasService {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly reloj: Reloj,
  ) {}

  /** SWR-03 y SWR-04: crea una franja con fecha, hora de inicio y de fin, sin traslapes. */
  async crear(tutorId: string, entrada: CrearFranjaInput): Promise<FranjaPropia> {
    const inicio = new Date(entrada.fechaInicio);
    const fin = new Date(entrada.fechaFin);
    validarHorario(inicio, fin, this.reloj.ahora());

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

        validarHorario(inicio, fin, this.reloj.ahora());
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
      await repos.franjas.marcarEliminada(franjaId, this.reloj.ahora());
    });
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
    const estado = await franjas.bloquearDelTutor(tutorId, franjaId);
    if (estado === null) {
      throw noEncontrado("La franja no existe.");
    }
    if (estado !== "LIBRE") {
      throw conflicto(MENSAJE_RESERVADA);
    }
  }
}
