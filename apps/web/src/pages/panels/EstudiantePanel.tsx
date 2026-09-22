import { useEffect, useMemo, useState } from "react";
import type { Disponibilidad } from "@portal-tutorias/shared";
import { PanelLayout } from "./PanelLayout";
import { EstadoVacio } from "../../components/EstadoVacio";
import { apiClient, ApiError } from "../../lib/api-client";

const formateadorFecha = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const formateadorHora = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
});

function formatearFranja(fechaInicio: string, fechaFin: string): string {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const fecha = formateadorFecha.format(inicio);
  const fechaCapitalizada = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  return `${fechaCapitalizada} · ${formateadorHora.format(inicio)} – ${formateadorHora.format(fin)}`;
}

const ICONO_CALENDARIO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17" strokeLinecap="round" />
    <path d="M8 3v3M16 3v3" strokeLinecap="round" />
    <circle cx="8.5" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export function EstudiantePanel() {
  const [disponibilidades, setDisponibilidades] = useState<Disponibilidad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [materiaFiltro, setMateriaFiltro] = useState("");

  useEffect(() => {
    let cancelado = false;

    apiClient
      .get<{ disponibilidades: Disponibilidad[] }>("/disponibilidad")
      .then((data) => {
        if (!cancelado) setDisponibilidades(data.disponibilidades);
      })
      .catch((err) => {
        if (!cancelado) {
          setError(err instanceof ApiError ? err.message : "No fue posible cargar la disponibilidad.");
        }
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const materias = useMemo(() => {
    if (!disponibilidades) return [];
    return Array.from(new Set(disponibilidades.map((d) => d.materia))).sort((a, b) => a.localeCompare(b, "es"));
  }, [disponibilidades]);

  const disponibilidadesFiltradas = useMemo(() => {
    if (!disponibilidades) return [];
    if (!materiaFiltro) return disponibilidades;
    return disponibilidades.filter((d) => d.materia === materiaFiltro);
  }, [disponibilidades, materiaFiltro]);

  return (
    <PanelLayout
      titulo="Panel del estudiante"
      categorias={[
        { etiqueta: "Disponibilidad", seleccionada: true },
        { etiqueta: "Mis tutorías", disponible: false },
      ]}
    >
      {error && (
        <p role="alert" className="mensaje-error">
          {error}
        </p>
      )}

      {!error && disponibilidades === null && <p className="texto-cargando">Cargando disponibilidad...</p>}

      {!error && disponibilidades !== null && disponibilidades.length === 0 && (
        <EstadoVacio
          icono={ICONO_CALENDARIO}
          titulo="Aún no hay tutorías disponibles"
          texto="Cuando los tutores publiquen sus franjas horarias, las verás aquí para poder agendar tu sesión. La reserva llega en una próxima entrega."
        />
      )}

      {!error && disponibilidades !== null && disponibilidades.length > 0 && (
        <div className="disponibilidad">
          <div className="disponibilidad__filtro campo">
            <label htmlFor="materia">Materia</label>
            <select id="materia" value={materiaFiltro} onChange={(e) => setMateriaFiltro(e.target.value)}>
              <option value="">Todas las materias</option>
              {materias.map((materia) => (
                <option key={materia} value={materia}>
                  {materia}
                </option>
              ))}
            </select>
          </div>

          {disponibilidadesFiltradas.length === 0 ? (
            <p className="texto-cargando">No hay franjas disponibles para esta materia.</p>
          ) : (
            <ul className="disponibilidad__lista">
              {disponibilidadesFiltradas.map((disponibilidad) => (
                <li key={disponibilidad.id} className="tarjeta-disponibilidad">
                  <span className="tarjeta-disponibilidad__materia">{disponibilidad.materia}</span>
                  <span className="tarjeta-disponibilidad__tutor">{disponibilidad.tutor.nombre}</span>
                  <span className="tarjeta-disponibilidad__horario">
                    {formatearFranja(disponibilidad.fechaInicio, disponibilidad.fechaFin)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PanelLayout>
  );
}
