export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  // Fastify rechaza un Content-Type: application/json con cuerpo vacio,
  // por eso una peticion sin payload (p. ej. logout) se envia como "{}".
  post: <T>(path: string, payload?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(payload ?? {}) }),
};
