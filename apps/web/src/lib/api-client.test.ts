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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient.post sin payload (p. ej. logout)", () => {
  it("nunca envia un cuerpo vacio junto a Content-Type: application/json", async () => {
    const fetchMock = mockFetchOnce({ status: 200, json: { ok: true } });

    await apiClient.post("/auth/logout");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.body).toBe("{}");
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
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
});
