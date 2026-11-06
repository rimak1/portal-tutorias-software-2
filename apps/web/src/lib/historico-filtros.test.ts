import { describe, expect, it } from "vitest";
import { SIN_FILTROS, aConsulta, errorDeFiltros, porcentaje, totalDePaginas } from "./historico-filtros";

const consulta = (cambios: Partial<typeof SIN_FILTROS>, pagina?: { pagina: number; tamano: number }) =>
  new URLSearchParams(aConsulta({ ...SIN_FILTROS, ...cambios }, pagina));

describe("aConsulta (F-09)", () => {
  it("sin filtros la consulta queda vacía", () => {
    expect(aConsulta(SIN_FILTROS)).toBe("");
  });

  it("envía solo los filtros que se llenaron", () => {
    const parametros = consulta({ tutorId: "t-1", estado: "FINALIZADA" });

    expect([...parametros.keys()].sort()).toEqual(["estado", "tutorId"]);
    expect(parametros.get("estado")).toBe("FINALIZADA");
  });

  it("«desde» es el inicio de ese día local", () => {
    const desde = new Date(consulta({ desde: "2026-11-05" }).get("desde")!);

    expect([desde.getFullYear(), desde.getMonth(), desde.getDate(), desde.getHours(), desde.getMinutes()]).toEqual([2026, 10, 5, 0, 0]);
  });

  it("«hasta» incluye todo ese día: se envía el inicio del día siguiente", () => {
    const hasta = new Date(consulta({ hasta: "2026-11-05" }).get("hasta")!);

    expect([hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), hasta.getHours()]).toEqual([2026, 10, 6, 0]);
  });

  it("«hasta» del último día del mes pasa al mes siguiente", () => {
    const hasta = new Date(consulta({ hasta: "2026-12-31" }).get("hasta")!);

    expect([hasta.getFullYear(), hasta.getMonth(), hasta.getDate()]).toEqual([2027, 0, 1]);
  });

  it("agrega la página y el tamaño", () => {
    const parametros = consulta({}, { pagina: 3, tamano: 20 });

    expect(parametros.get("pagina")).toBe("3");
    expect(parametros.get("tamano")).toBe("20");
  });

  it("ignora una fecha que no se puede interpretar", () => {
    expect(consulta({ desde: "basura" }).has("desde")).toBe(false);
  });
});

describe("errorDeFiltros", () => {
  it("acepta rangos coherentes, incluido un solo día", () => {
    expect(errorDeFiltros({ ...SIN_FILTROS, desde: "2026-11-05", hasta: "2026-11-05" })).toBeNull();
    expect(errorDeFiltros({ ...SIN_FILTROS, desde: "2026-11-05" })).toBeNull();
    expect(errorDeFiltros(SIN_FILTROS)).toBeNull();
  });

  it("rechaza un rango al revés", () => {
    expect(errorDeFiltros({ ...SIN_FILTROS, desde: "2026-11-06", hasta: "2026-11-05" })).toBe("La fecha inicial debe ser anterior o igual a la final.");
  });
});

describe("paginación y porcentajes", () => {
  it("totalDePaginas redondea hacia arriba y nunca baja de una", () => {
    expect([0, 1, 20, 21, 100].map((total) => totalDePaginas(total, 20))).toEqual([1, 1, 1, 2, 5]);
  });

  it("porcentaje redondea y no divide por cero", () => {
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(2, 3)).toBe(67);
    expect(porcentaje(0, 0)).toBe(0);
  });
});
