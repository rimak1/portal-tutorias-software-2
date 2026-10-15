import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  SESSION_SECRET: z.string().min(16),
  SESSION_COOKIE_NAME: z.string().default("portal_session"),
  SESSION_TTL_HORAS: z.coerce.number().default(12),

  RESET_TOKEN_SECRET: z.string().min(16),
  RESET_TOKEN_TTL_MINUTOS: z.coerce.number().default(30),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("Portal de Tutorias <no-responder@example.edu.co>"),
  EMAIL_ADAPTER: z.enum(["mock", "smtp"]).default("mock"),

  WEB_APP_URL: z.string().default("http://localhost:5173"),
}).superRefine((env, contexto) => {
  if (env.EMAIL_ADAPTER !== "smtp") return;
  for (const variable of ["SMTP_HOST", "SMTP_PORT"] as const) {
    if (env[variable] === undefined || env[variable] === "") {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: [variable], message: "es obligatoria cuando EMAIL_ADAPTER=smtp" });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

/**
 * Lee y valida la configuración del proceso.
 *
 * @throws Error con la lista de variables inválidas o faltantes.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const detalle = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variables de entorno inválidas o faltantes:\n${detalle}`);
  }
  return result.data;
}
