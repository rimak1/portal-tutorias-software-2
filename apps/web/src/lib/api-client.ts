/** Respuesta no exitosa de la API, con el mensaje que envió el servidor. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const MENSAJE_INESPERADO = "Ocurrió un error inesperado.";

/**
 * Mensaje que se muestra al usuario por un error: el del servidor si lo hubo,
 * o `porDefecto` si el error no vino de la API (p. ej. sin conexión).
 */
export function mensajeDeError(err: unknown, porDefecto: string): string {
  return err instanceof ApiError ? err.message : porDefecto;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Fastify rechaza Content-Type: application/json con un cuerpo vacío, así que
  // la cabecera solo se envía cuando hay cuerpo.
  const tieneCuerpo = options.body !== undefined;
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(tieneCuerpo ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const body = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const mensaje = (body as { message?: string } | null)?.message ?? MENSAJE_INESPERADO;
    throw new ApiError(mensaje, response.status);
  }

  return body as T;
}

// Un POST sin datos (p. ej. cerrar sesión o aprobar) se envía con el cuerpo "{}".
const conCuerpo = (metodo: string) => <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: metodo, body: JSON.stringify(payload ?? {}) });

/** Cliente HTTP de la API: agrega `/api`, envía la cookie de sesión y convierte los errores en ApiError. */
export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: conCuerpo("POST"),
  put: conCuerpo("PUT"),
  patch: conCuerpo("PATCH"),
  delete: <T = null>(path: string) => request<T>(path, { method: "DELETE" }),
};
