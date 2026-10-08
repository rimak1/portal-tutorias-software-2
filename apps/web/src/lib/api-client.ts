export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Fastify rechaza un Content-Type: application/json con cuerpo vacio, asi que
  // la cabecera solo se envia cuando realmente hay un cuerpo.
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
    const mensaje = (body as { message?: string } | null)?.message ?? "Ocurrio un error inesperado.";
    throw new ApiError(mensaje, response.status);
  }

  return body as T;
}

// Una peticion con cuerpo sin payload (p. ej. logout o aprobar) se envia como "{}".
const conCuerpo = (metodo: string) => <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: metodo, body: JSON.stringify(payload ?? {}) });

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: conCuerpo("POST"),
  put: conCuerpo("PUT"),
  patch: conCuerpo("PATCH"),
  delete: <T = null>(path: string) => request<T>(path, { method: "DELETE" }),
};
