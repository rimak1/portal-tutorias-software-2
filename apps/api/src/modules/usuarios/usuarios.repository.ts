import type { Cliente } from "../../db/cliente.js";
import { violaUnicidad } from "../../db/errores-postgres.js";
import {
  CorreoYaRegistrado,
  type CambiosDeCuenta,
  type Cuenta,
  type CuentaAdministrable,
  type DatosDeSesion,
  type FiltroDeCuentas,
  type NuevaCuenta,
  type RepositorioDeUsuarios,
} from "./usuarios.puertos.js";

/** Índice único del correo. */
const INDICE_CORREO = "usuario_correo_key";

const CAMPOS_ADMINISTRABLES = { id: true, correo: true, nombre: true, rol: true, activo: true, creadoEn: true } as const;

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

  listar(filtro: FiltroDeCuentas): Promise<CuentaAdministrable[]> {
    const { rol, activo, texto } = filtro;
    return this.db.usuario.findMany({
      where: {
        rol,
        activo,
        ...(texto ? { OR: [{ nombre: { contains: texto, mode: "insensitive" } }, { correo: { contains: texto, mode: "insensitive" } }] } : {}),
      },
      select: CAMPOS_ADMINISTRABLES,
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
    });
  }

  buscarAdministrable(id: string): Promise<CuentaAdministrable | null> {
    return this.db.usuario.findUnique({ where: { id }, select: CAMPOS_ADMINISTRABLES });
  }

  async crear(datos: NuevaCuenta): Promise<CuentaAdministrable> {
    try {
      return await this.db.usuario.create({ data: datos, select: CAMPOS_ADMINISTRABLES });
    } catch (error) {
      if (violaUnicidad(error, INDICE_CORREO)) throw new CorreoYaRegistrado();
      throw error;
    }
  }

  actualizar(id: string, cambios: CambiosDeCuenta): Promise<CuentaAdministrable> {
    return this.db.usuario.update({ where: { id }, data: cambios, select: CAMPOS_ADMINISTRABLES });
  }

  async bloquearAdministradoresActivos(): Promise<string[]> {
    const filas = await this.db.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "usuario" WHERE "rol" = 'ADMINISTRADOR' AND "activo" = true FOR UPDATE`;
    return filas.map((fila) => fila.id);
  }
}
