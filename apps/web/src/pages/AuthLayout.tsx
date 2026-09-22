import type { ReactNode } from "react";

function MotivoConexiones() {
  return (
    <svg
      className="auth-marca__motivo"
      viewBox="0 0 480 640"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke="var(--verde-400)" strokeWidth="1" opacity="0.4">
        <line x1="120" y1="90" x2="250" y2="260" />
        <line x1="250" y1="260" x2="340" y2="180" />
        <line x1="250" y1="260" x2="80" y2="320" />
        <line x1="250" y1="260" x2="180" y2="460" />
        <line x1="180" y1="460" x2="300" y2="520" />
        <line x1="340" y1="180" x2="380" y2="380" />
        <line x1="380" y1="380" x2="300" y2="520" />
        <line x1="80" y1="320" x2="60" y2="560" />
        <line x1="120" y1="90" x2="420" y2="140" />
      </g>
      <g fill="var(--dorado-400)">
        <circle cx="120" cy="90" r="7" />
        <circle cx="250" cy="260" r="9" />
        <circle cx="300" cy="520" r="7" />
      </g>
      <g fill="var(--verde-400)" opacity="0.85">
        <circle cx="340" cy="180" r="5" />
        <circle cx="80" cy="320" r="4" />
        <circle cx="380" cy="380" r="6" />
        <circle cx="180" cy="460" r="5" />
        <circle cx="60" cy="560" r="4" />
        <circle cx="420" cy="140" r="3" />
      </g>
    </svg>
  );
}

export function AuthLayout({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-layout">
      <section className="auth-marca">
        <MotivoConexiones />
        <div className="auth-marca__contenido">
          <span className="auth-marca__escudo">Portal de Tutorías Académicas</span>
          <h1 className="auth-marca__titulo">{titulo}</h1>
          <p className="auth-marca__texto">{texto}</p>
        </div>
      </section>
      <section className="auth-panel-formulario">{children}</section>
    </main>
  );
}
