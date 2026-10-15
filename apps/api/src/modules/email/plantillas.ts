export interface Correo {
  asunto: string;
  texto: string;
  html: string;
}

const ENTIDADES_HTML: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (caracter) => ENTIDADES_HTML[caracter]);
}

/** RF-003: correo con el enlace para restablecer la contraseña, en texto plano y en HTML. */
export function correoDeRecuperacion(enlace: string, minutosDeVigencia: number): Correo {
  const vigencia = `válido por ${minutosDeVigencia} minutos`;
  const aviso = "Si no solicitaste este cambio, ignora este mensaje.";
  const enlaceHtml = escaparHtml(enlace);

  return {
    asunto: "Restablecer tu contraseña - Portal de Tutorías",
    texto: `Para restablecer tu contraseña visita el siguiente enlace (${vigencia}):\n\n${enlace}\n\n${aviso}`,
    html:
      `<p>Para restablecer tu contraseña haz clic en el siguiente enlace (${vigencia}):</p>` +
      `<p><a href="${enlaceHtml}">${enlaceHtml}</a></p>` +
      `<p>${aviso}</p>`,
  };
}
