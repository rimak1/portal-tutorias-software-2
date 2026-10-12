import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorDeNegocio } from "../src/lib/errors.js";
import { ConsultaDeDisponibilidadService } from "../src/modules/disponibilidad/consulta-disponibilidad.service.js";
import { validarHorario } from "../src/modules/disponibilidad/franja.reglas.js";
import { GestionDeFranjasService } from "../src/modules/disponibilidad/gestion-franjas.service.js";
import { MundoEnMemoria, RelojFijo } from "./fakes.js";

const AHORA = new Date("2026-10-20T15:00:00Z");
const enHoras = (h: number) => new Date(AHORA.getTime() + h * 3600_000);

const codigoDe = (accion: () => unknown) => {
  try {
    accion();
  } catch (error) {
    return (error as ErrorDeNegocio).statusCode;
  }
  return null;
};

describe("validarHorario: regla pura de SWR-03 (sin base de datos ni dobles)", () => {
  it("acepta una franja futura con fin posterior al inicio", () => {
    expect(codigoDe(() => validarHorario(enHoras(1), enHoras(2), AHORA))).toBeNull();
  });

  it("rechaza fin igual o anterior al inicio", () => {
    expect(codigoDe(() => validarHorario(enHoras(2), enHoras(2), AHORA))).toBe(400);
    expect(codigoDe(() => validarHorario(enHoras(2), enHoras(1), AHORA))).toBe(400);
  });

  it("rechaza una franja que comienza ahora o antes; acepta un milisegundo despues", () => {
    expect(codigoDe(() => validarHorario(AHORA, enHoras(1), AHORA))).toBe(400);
    expect(codigoDe(() => validarHorario(enHoras(-1), enHoras(1), AHORA))).toBe(400);
    expect(codigoDe(() => validarHorario(new Date(AHORA.getTime() + 1), enHoras(1), AHORA))).toBeNull();
  });
});

describe("GestionDeFranjasService con repositorios en memoria", () => {
  let reloj: RelojFijo;
  let mundo: MundoEnMemoria;
  let gestion: GestionDeFranjasService;

  beforeEach(() => {
    reloj = new RelojFijo(AHORA);
    mundo = new MundoEnMemoria();
    mundo.agregarTutor("tutor-1", "Tutor Uno", true, ["materia-1"]);
    mundo.agregarTutor("tutor-2", "Tutor Dos", true, ["materia-1"]);
    gestion = new GestionDeFranjasService(mundo, reloj);
  });

  const crear = (inicioH: number, finH: number, tutorId = "tutor-1", materiaId = "materia-1") =>
    gestion.crear(tutorId, { materiaId, fechaInicio: enHoras(inicioH).toISOString(), fechaFin: enHoras(finH).toISOString() });

  it("crea una franja libre con los datos indicados", async () => {
    const franja = await crear(24, 25);

    expect(franja).toMatchObject({ estado: "LIBRE", fechaInicio: enHoras(24).toISOString(), fechaFin: enHoras(25).toISOString() });
  });

  it("SWR-04: rechaza el traslape, acepta las contiguas y no afecta a otro tutor", async () => {
    await crear(24, 26);

    await expect(crear(25, 27)).rejects.toMatchObject({ statusCode: 409 });
    await expect(crear(26, 27)).resolves.toBeDefined();
    await expect(crear(24, 26, "tutor-2")).resolves.toBeDefined();
  });

  it("la franja debe comenzar en el futuro segun el reloj inyectado", async () => {
    await expect(crear(0, 1)).rejects.toMatchObject({ statusCode: 400 });
    reloj.avanzarHoras(-1);
    await expect(crear(0, 1)).resolves.toBeDefined();
  });

  it("exige una materia del perfil del tutor", async () => {
    await expect(crear(24, 25, "tutor-1", "materia-ajena")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("SWR-05: elimina una franja libre usando la hora del reloj y no una reservada", async () => {
    const libre = mundo.agregarFranja("tutor-1", enHoras(24), enHoras(25));
    const reservada = mundo.agregarFranja("tutor-1", enHoras(30), enHoras(31), "RESERVADA");

    await gestion.eliminar("tutor-1", libre);
    await expect(gestion.eliminar("tutor-1", reservada)).rejects.toMatchObject({ statusCode: 409 });

    expect(mundo.franja(libre).eliminadaEn).toEqual(AHORA);
    expect(mundo.franja(reservada).eliminadaEn).toBeNull();
  });

  it("un tutor no puede eliminar la franja de otro", async () => {
    const ajena = mundo.agregarFranja("tutor-2", enHoras(24), enHoras(25));
    await expect(gestion.eliminar("tutor-1", ajena)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("ConsultaDeDisponibilidadService depende solo de la lectura de franjas (ISP)", () => {
  it("pide al repositorio las franjas desde el instante que indica el reloj", async () => {
    const listarLibresProximas = vi.fn(async () => []);
    const consulta = new ConsultaDeDisponibilidadService(
      {
        listarLibresProximas,
        listarVigentesDeTutor: vi.fn(async () => []),
        cargar: vi.fn(),
        existeTraslape: vi.fn(),
      },
      new RelojFijo(AHORA),
    );

    await consulta.listarProximas({ tutorId: "tutor-1" });

    expect(listarLibresProximas).toHaveBeenCalledWith({ tutorId: "tutor-1" }, AHORA);
  });
});
