import { useCallback, useMemo, useReducer, useState } from "react";
import { agruparPorTutor } from "../../../lib/agrupar-por-tutor";
import { citasApi } from "../../../lib/api/citas";
import { disponibilidadApi } from "../../../lib/api/disponibilidad";
import { materiasApi } from "../../../lib/api/materias";
import { EstadoDeCarga, MensajeError } from "../../../components/Mensajes";
import { mensajeDeError } from "../../../lib/api-client";
import { useDatos } from "../../../lib/use-datos";
import { IndicadorDePasos, PasoConfirmar, PasoElegirFranja, PasoElegirTutor } from "./PasosDeReserva";
import { RESERVA_INICIAL, reservaReducer } from "./reserva-wizard";

/**
 * SWR-25: reserva de una tutoría en tres pasos (elegir tutor, elegir franja,
 * confirmar) con una sola escritura al confirmar. Carga las franjas, que el
 * servidor entrega filtradas por materia y ordenadas por fecha (SWR-06 y
 * SWR-07), y avanza entre pasos con `reservaReducer`. Si la reserva falla
 * (p. ej. otro estudiante tomó la franja), vuelve a elegir franja con la lista actualizada.
 */
export function ReservarTutoria({ onReservada }: { onReservada: () => void }) {
  const [{ paso, materiaId, tutorId, franja, error }, despachar] = useReducer(reservaReducer, RESERVA_INICIAL);
  const [reservando, setReservando] = useState(false);

  const materias = useDatos(materiasApi.listarCatalogo);
  const cargarDisponibilidad = useCallback(() => disponibilidadApi.listar({ materiaId: materiaId || undefined }), [materiaId]);
  const disponibilidad = useDatos(cargarDisponibilidad);

  const tutores = useMemo(() => agruparPorTutor(disponibilidad.datos ?? []), [disponibilidad.datos]);
  const tutorElegido = tutores.find((t) => t.id === tutorId) ?? null;

  async function confirmar() {
    if (!franja) return;
    setReservando(true);
    try {
      await citasApi.reservar(franja.id);
      onReservada();
    } catch (err) {
      despachar({ tipo: "RESERVA_RECHAZADA", mensaje: mensajeDeError(err, "No fue posible registrar la reserva.") });
      await disponibilidad.recargar();
    } finally {
      setReservando(false);
    }
  }

  if (!disponibilidad.datos) {
    return <EstadoDeCarga error={disponibilidad.error} texto="Cargando disponibilidad..." />;
  }

  return (
    <div className="reserva">
      <IndicadorDePasos paso={paso} />

      {error && <MensajeError>{error}</MensajeError>}

      {paso === 1 && (
        <PasoElegirTutor
          materias={materias.datos ?? []}
          materiaId={materiaId}
          tutores={tutores}
          onCambiarMateria={(id) => despachar({ tipo: "CAMBIAR_MATERIA", materiaId: id })}
          onElegir={(id) => despachar({ tipo: "ELEGIR_TUTOR", tutorId: id })}
        />
      )}

      {paso === 2 && (
        <PasoElegirFranja
          tutor={tutorElegido}
          onElegir={(elegida) => despachar({ tipo: "ELEGIR_FRANJA", franja: elegida })}
          onVolver={() => despachar({ tipo: "VOLVER" })}
        />
      )}

      {paso === 3 && franja && (
        <PasoConfirmar franja={franja} reservando={reservando} onConfirmar={confirmar} onVolver={() => despachar({ tipo: "VOLVER" })} />
      )}
    </div>
  );
}
