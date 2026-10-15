import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";

const SENALES_DE_CIERRE = ["SIGINT", "SIGTERM"] as const;

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp(env);

  // Cierra el servidor y la conexión a la base de datos antes de terminar el proceso.
  for (const senal of SENALES_DE_CIERRE) {
    process.once(senal, () => {
      app.log.info({ senal }, "Cerrando el servidor");
      app.close().finally(() => process.exit(0));
    });
  }

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  console.error("No se pudo iniciar el servidor:", error);
  process.exit(1);
});
