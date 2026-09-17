import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDb } from "./db/client.js";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  async function shutdown(signal: string) {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    await closeDb();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
