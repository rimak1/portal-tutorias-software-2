import type { Cita, Rol } from "@portal-tutorias/shared";
import type { Repositorios, UnidadDeTrabajo } from "../../db/unidad-de-trabajo.js";
import { conflicto, esViolacionDeUnicidad, noEncontrado, solicitudInvalida } from "../../lib/errors.js";
import { estadoDe, type ContextoCita, type EstadoDeCita, type Transicion } from "./cita.estados.js";
import type { CambiosDeCita } from "./citas.eventos.js";
import { aCita } from "./citas.mapper.js";
import type { CamposDeCita, CitaCompleta } from "./citas.repository.js";

const MENSAJE_FRANJA_OCUPADA = "La franja ya fue reservada por otro estudiante. Elige otra.";
const MENSAJE_CITA_INEXISTENTE = "La cita no existe.";

type Participante = { rol: "ESTUDIANTE" | "TUTOR"; id: string };

interface Accion {
  citaId: string;
  actor: Participante;
  /** Lo decide el estado actual de la cita (patron State); lanza si la accion no es valida. */
  decidir: (estado: EstadoDeCita, contexto: ContextoCita) => Transicion;
  /** Campos de la cita que cambian ademas del estado. */
  datos?: Omit<CamposDeCita, "estado" | "franjaId">;
  /** Efectos propios de la accion, dentro de la misma transaccion. */
  efectos?: (repos: Repositorios, cita: CitaCompleta) => Promise<void>;
}

const comoTutor = (id: string): Participante => ({ rol: "TUTOR", id });
const comoEstudiante = (id: string): Participante => ({ rol: "ESTUDIANTE", id });

/**
 * Casos de uso del ciclo de vida de la cita (F-04, F-05, F-06 y F-11). Cada
 * accion es una declaracion corta sobre `transicionar`; las reglas de que
 * estado admite que accion viven en `cita.estados.ts`.
 */
export class CitasService {
  constructor(
    private readonly uow: UnidadDeTrabajo,
    private readonly cambios: CambiosDeCita,
  ) {}

  /** SWR-14: el estudiante y el tutor ven el estado actual de sus citas. */
  async listar(usuario: { id: string; rol: Rol }): Promise<Cita[]> {
    const { citas } = this.uow.repos;
    const encontradas = usuario.rol === "TUTOR" ? await citas.listarDeTutor(usuario.id) : await citas.listarDeEstudiante(usuario.id);
    return encontradas.map(aCita);
  }

  /**
   * SWR-08 y SWR-09: crea la cita Pendiente y reserva la franja en una sola
   * transaccion. La fila de la franja se bloquea (FOR UPDATE) y el indice unico
   * parcial sobre cita(franja_id) respalda la regla aunque falle la aplicacion.
   */
  async reservar(estudianteId: string, franjaId: string): Promise<Cita> {
    try {
      return await this.uow.ejecutar(async (repos) => {
        const franja = await repos.franjas.bloquearParaReserva(franjaId);
        if (!franja || !franja.tutorActivo) {
          throw noEncontrado("La franja no existe o ya no está disponible.");
        }
        if (franja.estado !== "LIBRE") {
          throw conflicto(MENSAJE_FRANJA_OCUPADA);
        }
        if (franja.fechaInicio <= new Date()) {
          throw solicitudInvalida("La franja ya comenzó. Elige otra.");
        }

        const cita = await repos.citas.crear(estudianteId, franjaId);
        await repos.franjas.cambiarEstado(franjaId, "RESERVADA");
        await this.cambios.publicar(
          { citaId: cita.id, estadoAnterior: null, estadoNuevo: "PENDIENTE", actorId: estudianteId, detalle: "Solicitud de tutoría creada" },
          repos,
        );
        return aCita(await repos.citas.cargar(cita.id));
      });
    } catch (error) {
      if (esViolacionDeUnicidad(error)) throw conflicto(MENSAJE_FRANJA_OCUPADA);
      throw error;
    }
  }

  /** SWR-10: el tutor aprueba una solicitud pendiente. */
  aprobar(tutorId: string, citaId: string): Promise<Cita> {
    return this.transicionar({ citaId, actor: comoTutor(tutorId), decidir: (estado, contexto) => estado.aprobar(contexto) });
  }

  /** SWR-12 y SWR-19: rechazo con motivo obligatorio; la cita queda Rechazada y la franja se libera (RN-007). */
  async rechazar(tutorId: string, citaId: string, motivo: string): Promise<Cita> {
    const motivoLimpio = motivo.trim();
    if (!motivoLimpio) {
      throw solicitudInvalida("Indica el motivo del rechazo.");
    }
    return this.transicionar({
      citaId,
      actor: comoTutor(tutorId),
      decidir: (estado, contexto) => ({ ...estado.rechazar(contexto), detalle: motivoLimpio }),
      datos: { motivoRechazo: motivoLimpio },
    });
  }

  /**
   * SWR-11: el tutor propone otra de sus franjas libres. La franja original se
   * libera (la libera la transicion) y la nueva queda reservada mientras el
   * estudiante decide.
   */
  reprogramar(tutorId: string, citaId: string, nuevaFranjaId: string): Promise<Cita> {
    return this.transicionar({
      citaId,
      actor: comoTutor(tutorId),
      decidir: (estado, contexto) => estado.reprogramar(contexto),
      efectos: async ({ franjas, citas }, cita) => {
        if (nuevaFranjaId === cita.franja.id) {
          throw solicitudInvalida("Elige una franja distinta a la actual.");
        }
        const nueva = await franjas.bloquearParaReprogramar(nuevaFranjaId);
        if (!nueva || nueva.tutorId !== tutorId) {
          throw noEncontrado("La franja propuesta no existe.");
        }
        if (nueva.estado !== "LIBRE") {
          throw conflicto("La franja propuesta ya no está libre.");
        }
        if (nueva.fechaInicio <= new Date()) {
          throw solicitudInvalida("La franja propuesta ya comenzó.");
        }

        await franjas.cambiarEstado(nuevaFranjaId, "RESERVADA");
        await citas.actualizar(cita.id, { franjaId: nuevaFranjaId });
        await citas.crearPropuesta({ citaId: cita.id, franjaOriginalId: cita.franja.id, franjaNuevaId: nuevaFranjaId });
      },
    });
  }

  /** El estudiante acepta la propuesta: la cita queda Aprobada en la franja nueva. */
  aceptarPropuesta(estudianteId: string, citaId: string): Promise<Cita> {
    return this.transicionar({
      citaId,
      actor: comoEstudiante(estudianteId),
      decidir: (estado, contexto) => estado.aceptarPropuesta(contexto),
      efectos: ({ citas }, cita) => citas.cerrarPropuesta(cita.propuestas[0].id, "ACEPTADA"),
    });
  }

  /** El estudiante rechaza la propuesta: la cita queda Cancelada y la franja nueva se libera. */
  rechazarPropuesta(estudianteId: string, citaId: string): Promise<Cita> {
    return this.transicionar({
      citaId,
      actor: comoEstudiante(estudianteId),
      decidir: (estado, contexto) => estado.rechazarPropuesta(contexto),
      efectos: ({ citas }, cita) => citas.cerrarPropuesta(cita.propuestas[0].id, "RECHAZADA"),
    });
  }

  /** SWR-21 y SWR-22: cancelar una cita Pendiente o Aprobada y liberar la franja. */
  cancelar(estudianteId: string, citaId: string): Promise<Cita> {
    return this.transicionar({
      citaId,
      actor: comoEstudiante(estudianteId),
      decidir: (estado, contexto) => estado.cancelar(contexto),
      efectos: async ({ citas }, cita) => {
        // Una propuesta pendiente se descarta junto con la cita.
        if (cita.propuestas[0]) await citas.cerrarPropuesta(cita.propuestas[0].id, "RECHAZADA");
      },
    });
  }

  /** SWR-13: el tutor finaliza una cita Aprobada desde su hora de inicio. */
  finalizar(tutorId: string, citaId: string): Promise<Cita> {
    return this.transicionar({
      citaId,
      actor: comoTutor(tutorId),
      decidir: (estado, contexto) => estado.finalizar(contexto),
      datos: { fechaFinalizacion: new Date() },
    });
  }

  /**
   * Template Method: el esqueleto comun de toda accion sobre una cita. Los
   * pasos que varian (que estado la admite y los efectos propios) los aporta
   * cada accion; el orden y la atomicidad no se pueden olvidar ni alterar.
   */
  private transicionar(accion: Accion): Promise<Cita> {
    return this.uow.ejecutar(async (repos) => {
      // 1. Bloquear la cita: acciones simultaneas se serializan y se revalida el estado ya con el bloqueo.
      const cita = await repos.citas.bloquearYCargar(accion.citaId);

      // 2. Autorizar: solo quien participa en la cita puede actuar; lo ajeno se reporta como inexistente.
      if (!cita || !this.participa(cita, accion.actor)) {
        throw noEncontrado(MENSAJE_CITA_INEXISTENTE);
      }

      // 3. El estado actual decide si la accion es valida y a donde lleva.
      const transicion = accion.decidir(estadoDe(cita.estado), {
        tienePropuestaPendiente: cita.propuestas.length > 0,
        inicioFranja: cita.franja.fechaInicio,
        ahora: new Date(),
      });

      // 4. Aplicar el cambio y, si corresponde, liberar la franja (RN-007).
      await repos.citas.actualizar(cita.id, { estado: transicion.hacia, ...accion.datos });
      if (transicion.liberaFranja) {
        await repos.franjas.cambiarEstado(cita.franja.id, "LIBRE");
      }
      await accion.efectos?.(repos, cita);

      // 5. Anunciar el cambio (bitacora y, mas adelante, notificaciones) dentro de la misma transaccion.
      await this.cambios.publicar(
        { citaId: cita.id, estadoAnterior: cita.estado, estadoNuevo: transicion.hacia, actorId: accion.actor.id, detalle: transicion.detalle },
        repos,
      );

      return aCita(await repos.citas.cargar(cita.id));
    });
  }

  private participa(cita: CitaCompleta, actor: Participante): boolean {
    return actor.rol === "TUTOR" ? cita.franja.tutor.id === actor.id : cita.estudiante.id === actor.id;
  }
}
