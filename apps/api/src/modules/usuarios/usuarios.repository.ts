import type { Cliente } from "../../db/cliente.js";
import type { Cuenta, DatosDeSesion, RepositorioDeUsuarios } from "./usuarios.puertos.js";

/** Cuentas de usuario sobre Prisma: único punto de acceso a la tabla `usuario`. */
export class UsuariosRepository implements RepositorioDeUsuarios {
  constructor(private readonly db: Cliente) {}

  buscarPorCorreo(correo: string): Promise<Cuenta | null> {
    return this.db.usuario.findUnique({ where: { correo } });
  }

  buscarPorId(id: string): Promise<Cuenta | null> {
    return this.db.usuario.findUnique({ where: { id } });
  }

  /** Solo lo necesario para validar una sesión: rol y estado de la cuenta, sin el hash. */
  buscarDatosDeSesion(id: string): Promise<DatosDeSesion | null> {
    return this.db.usuario.findUnique({
      where: { id },
      select: { id: true, correo: true, nombre: true, rol: true, activo: true },
    });
  }

  async actualizarPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.usuario.update({ where: { id }, data: { passwordHash } });
  }
}
