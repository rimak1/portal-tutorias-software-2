import type { Cliente } from "../../db/cliente.js";
import type { NotificacionGuardada, NuevaNotificacion, RepositorioDeNotificaciones } from "./notificaciones.puertos.js";

/** Avisos de los usuarios sobre Prisma: único punto de acceso a la tabla `notificacion`. */
export class NotificacionesRepository implements RepositorioDeNotificaciones {
  constructor(private readonly db: Cliente) {}

  async crear(notificacion: NuevaNotificacion): Promise<void> {
    await this.db.notificacion.create({ data: notificacion });
  }

  listar(usuarioId: string, limite: number): Promise<NotificacionGuardada[]> {
    return this.db.notificacion.findMany({
      where: { usuarioId },
      select: { id: true, titulo: true, texto: true, citaId: true, leidaEn: true, creadoEn: true },
      // El id desempata avisos creados en el mismo instante, para que el orden sea estable.
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
      take: limite,
    });
  }

  contarNoLeidas(usuarioId: string): Promise<number> {
    return this.db.notificacion.count({ where: { usuarioId, leidaEn: null } });
  }

  async marcarLeida(id: string, usuarioId: string, cuando: Date): Promise<boolean> {
    const { count } = await this.db.notificacion.updateMany({ where: { id, usuarioId, leidaEn: null }, data: { leidaEn: cuando } });
    if (count > 0) return true;
    // Sin cambios: o ya estaba leída (éxito) o no existe / es ajena (fallo).
    return (await this.db.notificacion.count({ where: { id, usuarioId } })) > 0;
  }

  async marcarTodasLeidas(usuarioId: string, cuando: Date): Promise<void> {
    await this.db.notificacion.updateMany({ where: { usuarioId, leidaEn: null }, data: { leidaEn: cuando } });
  }
}
