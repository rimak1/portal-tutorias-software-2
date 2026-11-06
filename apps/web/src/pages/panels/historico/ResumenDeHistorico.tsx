import { ESTADOS_CITA, type ResumenDeHistorico as Resumen } from "@portal-tutorias/shared";
import { ETIQUETA_ESTADO, porcentaje } from "../../../lib/historico-filtros";

/** Totales de todo el conjunto filtrado (F-09): cifras clave, reparto por estado, por materia y por tutor. */
export function ResumenDeHistorico({ resumen }: { resumen: Resumen }) {
  const { total, porEstado, horasFinalizadas } = resumen;

  return (
    <section className="resumen-historico" aria-label="Resumen del histórico">
      <dl className="cifras">
        <div className="cifra">
          <dt>Tutorías</dt>
          <dd>{total}</dd>
        </div>
        <div className="cifra">
          <dt>Finalizadas</dt>
          <dd>{porEstado.FINALIZADA}</dd>
        </div>
        <div className="cifra">
          <dt>Horas realizadas</dt>
          <dd>{horasFinalizadas.toLocaleString("es-CO")}</dd>
        </div>
        <div className="cifra">
          <dt>Rechazadas o canceladas</dt>
          <dd>{porEstado.RECHAZADA + porEstado.CANCELADA}</dd>
        </div>
      </dl>

      {total > 0 && (
        <div className="resumen-historico__detalle">
          <div className="resumen-bloque">
            <h3>Por estado</h3>
            <ul className="barras">
              {ESTADOS_CITA.map((estado) => (
                <li key={estado}>
                  <span className="barras__etiqueta">{ETIQUETA_ESTADO[estado]}</span>
                  <span className="barras__pista" aria-hidden="true">
                    <span className={`barras__relleno barras__relleno--${estado.toLowerCase()}`} style={{ width: `${porcentaje(porEstado[estado], total)}%` }} />
                  </span>
                  <span className="barras__valor">
                    {porEstado[estado]} <small>({porcentaje(porEstado[estado], total)} %)</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="resumen-bloque">
            <h3>Por materia</h3>
            <table className="tabla-datos tabla-datos--compacta">
              <thead>
                <tr>
                  <th scope="col">Materia</th>
                  <th scope="col">Tutorías</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porMateria.map((fila) => (
                  <tr key={fila.materia}>
                    <th scope="row">{fila.materia}</th>
                    <td>{fila.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="resumen-bloque">
            <h3>Por tutor</h3>
            <table className="tabla-datos tabla-datos--compacta">
              <thead>
                <tr>
                  <th scope="col">Tutor</th>
                  <th scope="col">Tutorías</th>
                  <th scope="col">Finalizadas</th>
                </tr>
              </thead>
              <tbody>
                {resumen.porTutor.map((fila) => (
                  <tr key={fila.tutor.id}>
                    <th scope="row">{fila.tutor.nombre}</th>
                    <td>{fila.total}</td>
                    <td>{fila.finalizadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
