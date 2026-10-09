import type { Cliente } from "../../db/cliente.js";

/** Repositorio de cuentas de usuario: unico punto de acceso a la tabla `usuario`. */
export class UsuariosRepository {
  constructor(private readonly db: Cliente) {}

  buscarPorCorreo(correo: string) {
    return this.db.usuario.findUnique({ where: { correo } });
  }

  buscarPorId(id: string) {
    return this.db.usuario.findUnique({ where: { id } });
  }

  /** Solo lo necesario para validar una sesion: rol y estado de la cuenta, sin el hash. */
  buscarDatosDeSesion(id: string) {
    return this.db.usuario.findUnique({
      where: { id },
      select: { id: true, correo: true, nombre: true, rol: true, activo: true },
    });
  }

  async actualizarPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.usuario.update({ where: { id }, data: { passwordHash } });
  }
}
