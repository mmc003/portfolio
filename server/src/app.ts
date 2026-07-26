import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { getEnv } from "./config/env";
import { requestId } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { notFound, errorHandler } from "./middleware/error";
import healthRouter from "./routes/health";

/**
 * Build the Express app. Exposed as a factory so tests can (re)build it under
 * different configuration without affecting the running server.
 */
export function createApp(): Express {
  // Validate env on app creation (fails fast with a clear message).
  const env = getEnv();

  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(compression());

  // CORS — allow a single origin, a comma-separated list, or "*".
  const origin =
    env.CORS_ORIGIN === "*"
      ? true
      : env.CORS_ORIGIN.includes(",")
        ? env.CORS_ORIGIN.split(",").map((s) => s.trim())
        : env.CORS_ORIGIN;
  app.use(cors({ origin }));

  app.use(express.json({ limit: "1mb" }));
  app.use(requestId);
  app.use(requestLogger);

  // Routes
  app.use("/api", healthRouter);

  // Local storage adapter serves objects at /media/<objectKey> with immutable
  // caching (keys are content-unique). The S3 driver serves directly from
  // object storage / CDN, so this route is only mounted for the local driver.
  if (env.STORAGE_DRIVER === "local") {
    app.use(
      "/media",
      express.static(env.STORAGE_LOCAL_DIR, {
        setHeaders: (res) => {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        },
      })
    );
  }

  // Fallbacks
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

/** Singleton app instance for the running server + supertest convenience. */
export const app = createApp();
