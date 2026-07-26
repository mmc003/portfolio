/**
 * Server bootstrap: validate config, start listening, and shut down gracefully.
 */
import { Server } from "http";
import { getEnv } from "./config/env";
import { getLogger } from "./utils/logger";
import { app } from "./app";

function start(): Server {
  const env = getEnv();
  const log = getLogger();

  if (env.ADMIN_API_TOKEN.startsWith("dev-admin-token")) {
    log.warn(
      "ADMIN_API_TOKEN is using the insecure dev fallback. Set a real token (production will refuse to start without one)."
    );
  }

  const server = app.listen(env.PORT, () => {
    log.info(
      `Portfolio API listening on :${env.PORT} (env=${env.NODE_ENV}, storage=${env.STORAGE_DRIVER})`
    );
  });

  const shutdown = (signal: string) => {
    log.info(`${signal} received — shutting down`);
    server.close((err) => {
      if (err) {
        log.error({ message: "error closing server", stack: err.stack });
        process.exit(1);
      }
      log.info("server closed");
      process.exit(0);
    });
    // Hard stop if graceful close hangs.
    setTimeout(() => {
      log.warn("forcing exit after shutdown timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}

// Only start when run directly (not when imported by tests).
if (require.main === module) {
  start();
}

export { start };
