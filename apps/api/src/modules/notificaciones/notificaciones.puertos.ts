export interface NotificacionGuardada {
  id: string;
  titulo: string;
  texto: string;
  citaId: string | null;
  leidaEn: Date | null;
  creadoEn: Date;
}

export interface NuevaNotificacion {
  usuarioId: string;
  citaId: string | null;
  titulo: string;
  texto: string;
}

/** Lo único que necesitan quienes generan avisos (el suscriptor de cambios de cita). */
export interface EscrituraDeNotificaciones {
  crear(notificacion: NuevaNotificacion): Promise<void>;
}

/** Los avisos de un usuario: nadie consulta ni modifica los de otro. */
export interface NotificacionesDelUsuario {
  /** Los más recientes primero, hasta `limite`. */
  listar(usuarioId: string, limite: number): Promise<NotificacionGuardada[]>;
  contarNoLeidas(usuarioId: string): Promise<number>;
  /** Devuelve false si el aviso no existe o es de otro usuario. Marcar uno ya leído no lo cambia. */
  marcarLeida(id: string, usuarioId: string, cuando: Date): Promise<boolean>;
  marcarTodasLeidas(usuarioId: string, cuando: Date): Promise<void>;
}

export interface RepositorioDeNotificaciones extends EscrituraDeNotificaciones, NotificacionesDelUsuario {}
