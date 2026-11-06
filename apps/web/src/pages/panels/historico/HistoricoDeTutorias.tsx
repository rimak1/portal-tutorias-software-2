import { useCallback, useState, type FormEvent } from "react";
import { EstadoVacio } from "../../../components/EstadoVacio";
import { IconoGrafica } from "../../../components/Iconos";
import { EstadoDeCarga, MensajeError } from "../../../components/Mensajes";
import { cuentasApi } from "../../../lib/api/cuentas";
import { historicoApi } from "../../../lib/api/historico";
import { materiasApi } from "../../../lib/api/materias";
import {
  ESTADOS_PARA_FILTRAR,
  ETIQUETA_ESTADO,
  SIN_FILTROS,
  aConsulta,
  errorDeFiltros,
  totalDePaginas,
  type FiltrosDeHistorico,
} from "../../../lib/historico-filtros";
import { useDatos } from "../../../lib/use-datos";
import { ResumenDeHistorico } from "./ResumenDeHistorico";
import { TablaDeHistorico } from "./TablaDeHistorico";

const TAMANO_DE_PAGINA = 20;

/**
 * F-09 (SWR-17): histórico y reportes de tutorías para el coordinador y el
 * administrador. Los filtros se aplican al enviar el formulario; el resumen
 * cubre todo el conjunto filtrado y la tabla se pagina.
 */
export function HistoricoDeTutorias() {
  const tutores = useDatos(cuentasApi.listar);
  const materias = useDatos(materiasApi.listarCatalogo);
  const [formulario, setFormulario] = useState<FiltrosDeHistorico>(SIN_FILTROS);
  const [aplicados, setAplicados] = useState<FiltrosDeHistorico>(SIN_FILTROS);
  const [pagina, setPagina] = useState(1);
  const [errorDeFiltro, setErrorDeFiltro] = useState<string | null>(null);

  const cargar = useCallback(() => historicoApi.consultar(aConsulta(aplicados, { pagina, tamano: TAMANO_DE_PAGINA })), [aplicados, pagina]);
  const { datos: historico, error } = useDatos(cargar);

  function aplicar(evento: FormEvent) {
    evento.preventDefault();
    const problema = errorDeFiltros(formulario);
    setErrorDeFiltro(problema);
    if (problema) return;
    setAplicados(formulario);
    setPagina(1);
  }

  function limpiar() {
    setFormulario(SIN_FILTROS);
    setAplicados(SIN_FILTROS);
    setErrorDeFiltro(null);
    setPagina(1);
  }

  const cambiar = (campo: keyof FiltrosDeHistorico) => (e: { target: { value: string } }) => setFormulario({ ...formulario, [campo]: e.target.value });
  const soloTutores = (tutores.datos ?? []).filter((cuenta) => cuenta.rol === "TUTOR");

  return (
    <div className="historico">
      <form className="historico__filtros" onSubmit={aplicar}>
        <div className="campo">
          <label htmlFor="hist-desde">Desde</label>
          <input id="hist-desde" type="date" value={formulario.desde} onChange={cambiar("desde")} />
        </div>
        <div className="campo">
          <label htmlFor="hist-hasta">Hasta</label>
          <input id="hist-hasta" type="date" value={formulario.hasta} onChange={cambiar("hasta")} />
        </div>
        <div className="campo">
          <label htmlFor="hist-tutor">Tutor</label>
          <select id="hist-tutor" value={formulario.tutorId} onChange={cambiar("tutorId")}>
            <option value="">Todos</option>
            {soloTutores.map((tutor) => (
              <option key={tutor.id} value={tutor.id}>
                {tutor.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="hist-materia">Materia</label>
          <select id="hist-materia" value={formulario.materiaId} onChange={cambiar("materiaId")}>
            <option value="">Todas</option>
            {(materias.datos ?? []).map((materia) => (
              <option key={materia.id} value={materia.id}>
                {materia.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="hist-estado">Estado</label>
          <select id="hist-estado" value={formulario.estado} onChange={cambiar("estado")}>
            <option value="">Todos</option>
            {ESTADOS_PARA_FILTRAR.map((estado) => (
              <option key={estado} value={estado}>
                {ETIQUETA_ESTADO[estado]}
              </option>
            ))}
          </select>
        </div>
        <div className="historico__acciones">
          <button type="submit" className="boton boton--primario">
            Aplicar filtros
          </button>
          <button type="button" className="boton boton--secundario" onClick={limpiar}>
            Limpiar
          </button>
          <a className="boton boton--secundario" href={historicoApi.urlDeExportacion(aConsulta(aplicados))} download>
            Exportar a CSV
          </a>
        </div>
      </form>

      {errorDeFiltro && <MensajeError>{errorDeFiltro}</MensajeError>}

      {!historico ? (
        <EstadoDeCarga error={error} texto="Cargando el histórico..." />
      ) : (
        <>
          {error && <MensajeError>{error}</MensajeError>}
          <ResumenDeHistorico resumen={historico.resumen} />

          {historico.truncado && (
            <p className="mensaje-error">El filtro cubre más tutorías de las que se pueden totalizar de una vez; los totales son parciales. Acota el rango de fechas.</p>
          )}

          {historico.total === 0 ? (
            <EstadoVacio
              icono={<IconoGrafica />}
              titulo="No hay tutorías con esos filtros"
              texto="Prueba con un rango de fechas más amplio o quita algún filtro."
            />
          ) : (
            <>
              <TablaDeHistorico citas={historico.citas} />
              <Paginacion pagina={historico.pagina} paginas={totalDePaginas(historico.total, historico.tamano)} total={historico.total} onCambiar={setPagina} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Paginacion({ pagina, paginas, total, onCambiar }: { pagina: number; paginas: number; total: number; onCambiar: (pagina: number) => void }) {
  return (
    <nav className="paginacion" aria-label="Paginación del histórico">
      <button type="button" className="boton boton--secundario" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
        Anterior
      </button>
      <span>
        Página {pagina} de {paginas} · {total} tutorías
      </span>
      <button type="button" className="boton boton--secundario" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>
        Siguiente
      </button>
    </nav>
  );
}
