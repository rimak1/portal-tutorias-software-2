import type { DetalleDeHistorico, FiltroDeHistorico as FiltroSolicitado, Historico, PaginaDeHistorico } from "@portal-tutorias/shared";
import { noEncontrado } from "../../lib/errors.js";
import { aCita } from "../citas/citas.mapper.js";
import type { EventoGuardado, FiltroDeHistorico, HistoricoDeCitas } from "../citas/citas.puertos.js";
import { historicoACsv } from "./historico.csv.js";
import { resumirHistorico } from "./historico.resumen.js";

/** Tope de citas que el sistema reúne de una vez para totalizar; con más, se avisa para que se acote el rango. */
export const LIMITE_DE_HISTORICO = 5000;

export const MENSAJE_CITA_INEXISTENTE = "La cita no existe.";

const aFiltroDeDominio = (filtro: FiltroSolicitado): FiltroDeHistorico => ({
  desde: filtro.desde ? new Date(filtro.desde) : undefined,
  hasta: filtro.hasta ? new Date(filtro.hasta) : undefined,
  tutorId: filtro.tutorId,
  materiaId: filtro.materiaId,
  estado: filtro.estado,
});

const aEvento = (evento: EventoGuardado) => ({
  estadoAnterior: evento.estadoAnterior,
  estadoNuevo: evento.estadoNuevo,
  actor: evento.actor,
  detalle: evento.detalle,
  creadoEn: evento.creadoEn.toISOString(),
});

/** F-09 (SWR-17): histórico y reportes de tutorías para el coordinador académico y el administrador. */
export class HistoricoService {
  constructor(private readonly citas: HistoricoDeCitas) {}

  /** Tutorías que cumplen los filtros (una página) y los totales de todas ellas. */
  async consultar(filtro: FiltroSolicitado, { pagina, tamano }: PaginaDeHistorico): Promise<Historico> {
    const encontradas = await this.citas.buscarEnHistorico(aFiltroDeDominio(filtro), LIMITE_DE_HISTORICO);
    const desde = (pagina - 1) * tamano;
    return {
      citas: encontradas.slice(desde, desde + tamano).map(aCita),
      pagina,
      tamano,
      total: encontradas.length,
      resumen: resumirHistorico(encontradas),
      truncado: encontradas.length >= LIMITE_DE_HISTORICO,
    };
  }

  /** Una tutoría con la bitácora de sus cambios de estado (BR-04). @throws ErrorDeNegocio 404 si no existe. */
  async detalle(citaId: string): Promise<DetalleDeHistorico> {
    const cita = await this.citas.buscar(citaId);
    if (!cita) {
      throw noEncontrado(MENSAJE_CITA_INEXISTENTE);
    }
    return { cita: aCita(cita), eventos: (await this.citas.listarEventos(citaId)).map(aEvento) };
  }

  /** Todas las tutorías que cumplen los filtros, para abrirlas en una hoja de cálculo. */
  async exportarCsv(filtro: FiltroSolicitado): Promise<string> {
    const encontradas = await this.citas.buscarEnHistorico(aFiltroDeDominio(filtro), LIMITE_DE_HISTORICO);
    return historicoACsv(encontradas.map(aCita));
  }
}
