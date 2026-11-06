import { useEffect, useRef, useState } from "react";
import { mensajeDeError } from "../lib/api-client";
import { etiquetaDeCampana, textoDeContador, tiempoRelativo } from "../lib/notificaciones";
import { useNotificaciones } from "../lib/use-notificaciones";
import { IconoCampana } from "./Iconos";

/**
 * F-07 (SWR-15): campana del encabezado con los avisos sobre las citas del
 * usuario. Muestra cuántos hay sin leer; al abrirla lista los más recientes y
 * deja marcarlos como leídos.
 */
export function CampanaDeNotificaciones() {
  const { notificaciones, noLeidas, cargado, error, recargar, marcarLeida, marcarTodasLeidas } = useNotificaciones();
  const [abierta, setAbierta] = useState(false);
  const [errorDeAccion, setErrorDeAccion] = useState<string | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);

  // La bandeja se cierra con Escape o al hacer clic fuera de ella.
  useEffect(() => {
    if (!abierta) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierta(false);
    };
    const alHacerClic = (evento: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(evento.target as Node)) setAbierta(false);
    };
    document.addEventListener("keydown", alPulsar);
    document.addEventListener("mousedown", alHacerClic);
    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.removeEventListener("mousedown", alHacerClic);
    };
  }, [abierta]);

  function alternar() {
    setErrorDeAccion(null);
    if (!abierta) void recargar();
    setAbierta(!abierta);
  }

  async function ejecutar(accion: () => Promise<void>) {
    setErrorDeAccion(null);
    try {
      await accion();
    } catch (err) {
      setErrorDeAccion(mensajeDeError(err, "No fue posible actualizar los avisos."));
    }
  }

  return (
    <div className="campana" ref={contenedor}>
      <button
        type="button"
        className="campana__boton"
        aria-label={etiquetaDeCampana(noLeidas)}
        aria-expanded={abierta}
        aria-controls="bandeja-de-notificaciones"
        onClick={alternar}
      >
        <IconoCampana />
        {noLeidas > 0 && <span className="campana__contador">{textoDeContador(noLeidas)}</span>}
      </button>

      {abierta && (
        <section id="bandeja-de-notificaciones" className="campana__bandeja" aria-label="Notificaciones">
          <header className="campana__encabezado">
            <h2>Notificaciones</h2>
            {noLeidas > 0 && (
              <button type="button" className="enlace-boton" onClick={() => void ejecutar(marcarTodasLeidas)}>
                Marcar todas como leídas
              </button>
            )}
          </header>

          {(error || errorDeAccion) && (
            <p role="alert" className="mensaje-error">
              {errorDeAccion ?? error}
            </p>
          )}

          {!cargado && !error ? (
            <p className="campana__vacia">Cargando...</p>
          ) : notificaciones.length === 0 ? (
            <p className="campana__vacia">Aún no tienes avisos. Te avisaremos cuando cambie el estado de una de tus tutorías.</p>
          ) : (
            <ul className="campana__lista">
              {notificaciones.map((aviso) => (
                <li key={aviso.id} className={aviso.leida ? "aviso" : "aviso aviso--nuevo"}>
                  <div className="aviso__cuerpo">
                    <strong>{aviso.titulo}</strong>
                    <span>{aviso.texto}</span>
                    <time dateTime={aviso.creadoEn}>{tiempoRelativo(aviso.creadoEn)}</time>
                  </div>
                  {!aviso.leida && (
                    <button type="button" className="enlace-boton" onClick={() => void ejecutar(() => marcarLeida(aviso.id))}>
                      Marcar como leído
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
