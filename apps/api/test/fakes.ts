import type { EstadoCita, EstadoFranja } from "@portal-tutorias/shared";
import type { Repositorios, UnidadDeTrabajo } from "../src/db/puertos.js";
import type { Reloj } from "../src/lib/reloj.js";
import type { CitaConRelaciones, RangoDeFranja, RegistroDeHistorial } from "../src/modules/citas/citas.puertos.js";
import type { FranjaConRelaciones } from "../src/modules/disponibilidad/franjas.puertos.js";
import type { ActualizadorDePassword, BuscadorDeCuentas, Cuenta } from "../src/modules/usuarios/usuarios.puertos.js";

/**
 * Implementaciones en memoria de los puertos. Existen porque los servicios
 * dependen de abstracciones (DIP): sus reglas se prueban sin base de datos.
 */

export class RelojFijo implements Reloj {
  constructor(private instante: Date) {}

  ahora(): Date {
    return new Date(this.instante);
  }

  avanzarHoras(horas: number): void {
    this.instante = new Date(this.instante.getTime() + horas * 3600_000);
  }
}

interface FilaFranja {
  id: string;
  tutorId: string;
  materiaId: string;
  fechaInicio: Date;
  fechaFin: Date;
  estado: EstadoFranja;
  eliminadaEn: Date | null;
}

interface FilaCita {
  id: string;
  estudianteId: string;
  franjaId: string;
  estado: EstadoCita;
  motivoRechazo: string | null;
  creadoEn: Date;
  fechaFinalizacion: Date | null;
}

interface FilaPropuesta {
  id: string;
  citaId: string;
  franjaOriginalId: string;
  franjaNuevaId: string;
  estado: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
}

interface Datos {
  franjas: Map<string, FilaFranja>;
  citas: Map<string, FilaCita>;
  propuestas: FilaPropuesta[];
  historial: RegistroDeHistorial[];
  perfiles: Map<string, Set<string>>;
}

const copiar = (datos: Datos): Datos => ({
  franjas: new Map([...datos.franjas].map(([k, v]) => [k, { ...v }])),
  citas: new Map([...datos.citas].map(([k, v]) => [k, { ...v }])),
  propuestas: datos.propuestas.map((p) => ({ ...p })),
  historial: datos.historial.map((h) => ({ ...h })),
  perfiles: new Map([...datos.perfiles].map(([k, v]) => [k, new Set(v)])),
});

export class MundoEnMemoria implements UnidadDeTrabajo {
  datos: Datos = { franjas: new Map(), citas: new Map(), propuestas: [], historial: [], perfiles: new Map() };
  readonly nombres = new Map<string, string>();
  readonly tutoresInactivos = new Set<string>();
  readonly repos: Repositorios;
  private contador = 0;

  constructor() {
    this.repos = this.crearRepositorios(this);
  }

  private nuevoId = (prefijo: string) => `${prefijo}-${++this.contador}`;

  /** Como la unidad de trabajo real: si el caso de uso lanza, se descartan todos sus cambios. */
  async ejecutar<T>(trabajo: (repos: Repositorios) => Promise<T>): Promise<T> {
    const respaldo = copiar(this.datos);
    try {
      return await trabajo(this.repos);
    } catch (error) {
      this.datos = respaldo;
      throw error;
    }
  }

  // --- Datos de partida para las pruebas ---

  agregarTutor(id: string, nombre: string, activo = true, materiaIds: string[] = []): void {
    this.nombres.set(id, nombre);
    if (!activo) this.tutoresInactivos.add(id);
    this.datos.perfiles.set(id, new Set(materiaIds));
  }

  agregarEstudiante(id: string, nombre: string): void {
    this.nombres.set(id, nombre);
  }

  agregarFranja(tutorId: string, inicio: Date, fin: Date, estado: EstadoFranja = "LIBRE", materiaId = "materia-1"): string {
    const id = this.nuevoId("franja");
    this.datos.franjas.set(id, { id, tutorId, materiaId, fechaInicio: inicio, fechaFin: fin, estado, eliminadaEn: null });
    return id;
  }

  agregarCita(estudianteId: string, franjaId: string, estado: EstadoCita): string {
    const id = this.nuevoId("cita");
    this.datos.citas.set(id, { id, estudianteId, franjaId, estado, motivoRechazo: null, creadoEn: new Date(0), fechaFinalizacion: null });
    return id;
  }

  franja = (id: string) => this.datos.franjas.get(id)!;
  cita = (id: string) => this.datos.citas.get(id)!;

  // --- Repositorios ---

  private rango = (f: FilaFranja): RangoDeFranja => ({ id: f.id, fechaInicio: f.fechaInicio, fechaFin: f.fechaFin });

  private conRelaciones = (f: FilaFranja): FranjaConRelaciones => ({
    id: f.id,
    materia: { id: f.materiaId, nombre: "Materia" },
    tutor: { id: f.tutorId, nombre: this.nombres.get(f.tutorId) ?? "" },
    fechaInicio: f.fechaInicio,
    fechaFin: f.fechaFin,
    estado: f.estado,
  });

  private citaConRelaciones = (c: FilaCita): CitaConRelaciones => {
    const f = this.datos.franjas.get(c.franjaId)!;
    return {
      id: c.id,
      estado: c.estado,
      motivoRechazo: c.motivoRechazo,
      creadoEn: c.creadoEn,
      fechaFinalizacion: c.fechaFinalizacion,
      estudiante: { id: c.estudianteId, nombre: this.nombres.get(c.estudianteId) ?? "" },
      franja: { ...this.rango(f), materia: { nombre: "Materia" }, tutor: { id: f.tutorId, nombre: this.nombres.get(f.tutorId) ?? "" } },
      propuestas: this.datos.propuestas
        .filter((p) => p.citaId === c.id && p.estado === "PENDIENTE")
        .map((p) => ({ id: p.id, franjaOriginal: this.rango(this.datos.franjas.get(p.franjaOriginalId)!) })),
    };
  };

  private crearRepositorios(mundo: MundoEnMemoria): Repositorios {
    return {
      usuarios: {
        async buscarPorCorreo() {
          return null;
        },
        async buscarPorId() {
          return null;
        },
        async buscarDatosDeSesion() {
          return null;
        },
        async actualizarPasswordHash() {},
      },
      materias: {
        async listarCatalogo() {
          return [];
        },
        async listarDeTutor() {
          return [];
        },
        async contarExistentes() {
          return 0;
        },
        async tutorImparte(tutorId, materiaId) {
          return mundo.datos.perfiles.get(tutorId)?.has(materiaId) ?? false;
        },
        async buscarMateriaConFranjasVigentesFueraDe() {
          return null;
        },
        async reemplazarDeTutor() {},
      },
      franjas: {
        async listarLibresProximas(filtros, desde) {
          return [...mundo.datos.franjas.values()]
            .filter((f) => f.estado === "LIBRE" && !f.eliminadaEn && f.fechaInicio >= desde && !mundo.tutoresInactivos.has(f.tutorId))
            .filter((f) => !filtros.tutorId || f.tutorId === filtros.tutorId)
            .sort((a, b) => a.fechaInicio.getTime() - b.fechaInicio.getTime())
            .map(mundo.conRelaciones);
        },
        async listarVigentesDeTutor(tutorId, desde) {
          return [...mundo.datos.franjas.values()].filter((f) => f.tutorId === tutorId && !f.eliminadaEn && f.fechaFin >= desde).map(mundo.conRelaciones);
        },
        async crear(datos) {
          const id = mundo.agregarFranja(datos.tutorId, datos.fechaInicio, datos.fechaFin, "LIBRE", datos.materiaId);
          return mundo.conRelaciones(mundo.franja(id));
        },
        async actualizar(id, datos) {
          Object.assign(mundo.franja(id), datos);
          return mundo.conRelaciones(mundo.franja(id));
        },
        async cargar(id) {
          return mundo.franja(id);
        },
        async marcarEliminada(id, cuando) {
          mundo.franja(id).eliminadaEn = cuando;
        },
        async cambiarEstado(id, estado) {
          mundo.franja(id).estado = estado;
        },
        async existeTraslape(tutorId, inicio, fin, ignorarId) {
          return [...mundo.datos.franjas.values()].some(
            (f) => f.tutorId === tutorId && !f.eliminadaEn && f.id !== ignorarId && f.fechaInicio < fin && f.fechaFin > inicio,
          );
        },
        async bloquearDelTutor(tutorId, franjaId) {
          const f = mundo.datos.franjas.get(franjaId);
          return f && f.tutorId === tutorId && !f.eliminadaEn ? f.estado : null;
        },
        async bloquearParaReserva(franjaId) {
          const f = mundo.datos.franjas.get(franjaId);
          return f && !f.eliminadaEn ? { estado: f.estado, fechaInicio: f.fechaInicio, tutorActivo: !mundo.tutoresInactivos.has(f.tutorId) } : null;
        },
        async bloquearParaReprogramar(franjaId) {
          const f = mundo.datos.franjas.get(franjaId);
          return f && !f.eliminadaEn ? { estado: f.estado, fechaInicio: f.fechaInicio, tutorId: f.tutorId } : null;
        },
      },
      citas: {
        async crear(estudianteId, franjaId) {
          return { id: mundo.agregarCita(estudianteId, franjaId, "PENDIENTE") };
        },
        async cargar(id) {
          return mundo.citaConRelaciones(mundo.cita(id));
        },
        async bloquearYCargar(id) {
          const c = mundo.datos.citas.get(id);
          return c ? mundo.citaConRelaciones(c) : null;
        },
        async listarDeEstudiante(estudianteId) {
          return [...mundo.datos.citas.values()].filter((c) => c.estudianteId === estudianteId).map(mundo.citaConRelaciones);
        },
        async listarDeTutor(tutorId) {
          return [...mundo.datos.citas.values()]
            .filter((c) => mundo.franja(c.franjaId).tutorId === tutorId)
            .map(mundo.citaConRelaciones);
        },
        async actualizar(id, cambios) {
          Object.assign(mundo.cita(id), cambios);
        },
        async crearPropuesta(datos) {
          mundo.datos.propuestas.push({ id: mundo.nuevoId("propuesta"), estado: "PENDIENTE", ...datos });
        },
        async cerrarPropuesta(id, estado) {
          const propuesta = mundo.datos.propuestas.find((p) => p.id === id)!;
          propuesta.estado = estado;
        },
        async registrarHistorial(registro) {
          mundo.datos.historial.push(registro);
        },
      },
    };
  }
}

/** Cuentas en memoria: implementa solo las interfaces que consume la recuperacion de contrasena (ISP). */
export class CuentasEnMemoria implements BuscadorDeCuentas, ActualizadorDePassword {
  constructor(readonly cuentas: Cuenta[]) {}

  async buscarPorCorreo(correo: string) {
    return this.cuentas.find((c) => c.correo === correo) ?? null;
  }

  async buscarPorId(id: string) {
    return this.cuentas.find((c) => c.id === id) ?? null;
  }

  async actualizarPasswordHash(id: string, passwordHash: string) {
    const cuenta = this.cuentas.find((c) => c.id === id);
    if (cuenta) cuenta.passwordHash = passwordHash;
  }
}
