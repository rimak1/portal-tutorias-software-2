import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient, ApiError } from "./api-client";

function mockFetchOnce(response: { status: number; json?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    json: () => Promise.resolve(response.json ?? null),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ultimaPeticion = (fetchMock: ReturnType<typeof mockFetchOnce>) =>
  fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient.post sin payload (p. ej. logout)", () => {
  it("nunca envia un cuerpo vacio junto a Content-Type: application/json", async () => {
    const fetchMock = mockFetchOnce({ status: 200, json: { ok: true } });

    await apiClient.post("/auth/logout");

    const [, options] = ultimaPeticion(fetchMock);
    expect(options.body).toBe("{}");
    expect(options.headers["Content-Type"]).toBe("application/json");
  });
});

describe("metodos con y sin cuerpo", () => {
  it("PUT y PATCH envian el payload como JSON", async () => {
    const put = mockFetchOnce({ status: 200, json: {} });
    await apiClient.put("/tutores/yo/materias", { materiaIds: ["a"] });
    expect(ultimaPeticion(put)[1]).toMatchObject({ method: "PUT", body: JSON.stringify({ materiaIds: ["a"] }) });

    const patch = mockFetchOnce({ status: 200, json: {} });
    await apiClient.patch("/disponibilidad/1", { fechaFin: "x" });
    expect(ultimaPeticion(patch)[1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ fechaFin: "x" }) });
  });

  it("GET y DELETE no envian cuerpo ni Content-Type (Fastify lo rechazaria)", async () => {
    const get = mockFetchOnce({ status: 200, json: {} });
    await apiClient.get("/materias");
    expect(ultimaPeticion(get)[1].body).toBeUndefined();
    expect(ultimaPeticion(get)[1].headers["Content-Type"]).toBeUndefined();

    const borrar = mockFetchOnce({ status: 204 });
    await expect(apiClient.delete("/disponibilidad/1")).resolves.toBeNull();
    expect(ultimaPeticion(borrar)[1]).toMatchObject({ method: "DELETE" });
    expect(ultimaPeticion(borrar)[1].body).toBeUndefined();
    expect(ultimaPeticion(borrar)[1].headers["Content-Type"]).toBeUndefined();
  });
});

describe("apiClient errores", () => {
  it("lanza ApiError con el mensaje del servidor cuando la respuesta no es ok", async () => {
    mockFetchOnce({ status: 401, json: { message: "Correo o contrasena incorrectos." } });

    await expect(apiClient.post("/auth/login", { correo: "a@a.com", password: "x" })).rejects.toMatchObject({
      message: "Correo o contrasena incorrectos.",
      status: 401,
    } satisfies Partial<ApiError>);
  });

  it("conserva el estado 409 para que la interfaz distinga un conflicto de reserva", async () => {
    mockFetchOnce({ status: 409, json: { message: "La franja ya fue reservada por otro estudiante. Elige otra." } });

    await expect(apiClient.post("/citas", { disponibilidadId: "x" })).rejects.toMatchObject({ status: 409 });
  });
});
