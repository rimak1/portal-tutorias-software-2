import { describe, expect, it } from "vitest";
import { correoDeRecuperacion } from "../src/modules/email/plantillas.js";

describe("correoDeRecuperacion", () => {
  it("incluye el enlace y la vigencia en el texto y en el HTML", () => {
    const correo = correoDeRecuperacion("http://localhost:5173/restablecer-password?token=abc", 30);

    expect(correo.texto).toContain("http://localhost:5173/restablecer-password?token=abc");
    expect(correo.texto).toContain("30 minutos");
    expect(correo.html).toContain('href="http://localhost:5173/restablecer-password?token=abc"');
  });

  it("escapa el enlace dentro del HTML", () => {
    const correo = correoDeRecuperacion('http://x/?a=1&b="><script>', 30);

    expect(correo.html).not.toContain("<script>");
    expect(correo.html).toContain("&amp;b=&quot;&gt;&lt;script&gt;");
  });
});
