import type { ActualizarFranjaInput, CrearFranjaInput, FranjaPropia } from "@portal-tutorias/shared";
import type { Repositorios, UnidadDeTrabajo } from "../../db/puertos.js";
import { conflicto, noEncontrado, solicitudInvalida } from "../../lib/errors.js";
import type { Reloj } from "../../lib/reloj.js";
import { validarHorario } from "./franja.reglas.js";
import { aFranjaPropia } from "./franjas.mapper.js";
import { FranjaTraslapada } from "./franjas.puertos.js";

/** F-02: el tutor crea, modifica y elimina sus franjas (SWR-03, SWR-04 y SWR-05). */
export class GestionDeFranjasService {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly reloj: Reloj,
  ) {}

  /**
   * SWR-03 y SWR-04: publica una franja futura de una materia del perfil del
   * tutor, sin cruzarse con sus otras franjas. Si dos solicitudes simultáneas
   * pasan la verificación previa, la restricción de la base de datos rechaza la segunda.
   *
   * @throws ErrorDeNegocio 400 si el horario no es válido o la materia no está en el perfil.
   * @throws FranjaTraslapada (409) si se cruza con otra franja del tutor.
   */
  async crear(tutorId: string, entrada: CrearFranjaInput): Promise<FranjaPropia> {
    const inicio = new Date(entrada.fechaInicio);
    const fin = new Date(entrada.fechaFin);
    validarHorario(inicio, fin, this.reloj.ahora());

    const repos = this.uow.repos;
    await this.exigirMateriaDelPerfil(repos, tutorId, entrada.materiaId);
    await this.exigirSinTraslape(repos, tutorId, inicio, fin);

    const franja = await repos.franjas.crear({ tutorId, materiaId: entrada.materiaId, fechaInicio: inicio, fechaFin: fin });
    return aFranjaPropia(franja);
  }

  /**
   * RN-003: modifica una franja del tutor que no esté reservada. Los campos
   * omitidos conservan su valor.
   *
   * @throws ErrorDeNegocio 400 si el horario no es válido o la materia nueva no está en el perfil.
   * @throws ErrorDeNegocio 404 si la franja no existe o no es del tutor.
   * @throws ErrorDeNegocio 409 si la franja está reservada.
   * @throws FranjaTraslapada (409) si el nuevo horario se cruza con otra franja del tutor.
   */
  actualizar(tutorId: string, franjaId: string, cambios: ActualizarFranjaInput): Promise<FranjaPropia> {
    return this.uow.ejecutar(async (repos) => {
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
  }

  /**
   * SWR-05: elimina una franja del tutor que aún no ha sido reservada. La
   * eliminación es lógica: las citas rechazadas o canceladas conservan su referencia.
   *
   * @throws ErrorDeNegocio 404 si la franja no existe o no es del tutor.
   * @throws ErrorDeNegocio 409 si la franja está reservada.
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
      throw new FranjaTraslapada();
    }
  }

  /** Bloquea la franja para que no la reserven mientras se modifica o elimina, y exige que siga libre. */
  private async bloquearFranjaLibreDelTutor({ franjas }: Repositorios, tutorId: string, franjaId: string): Promise<void> {
    const estado = await franjas.bloquearDelTutor(tutorId, franjaId);
    if (estado === null) {
      throw noEncontrado("La franja no existe.");
    }
    if (estado !== "LIBRE") {
      throw conflicto("Esta franja ya está reservada: gestiona primero la cita asociada.");
    }
  }
}
