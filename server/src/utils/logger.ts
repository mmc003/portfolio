/** Structured logger (pino). Pretty in dev, JSON in production. */
import pino, { Logger } from "pino";
import { getEnv } from "../config/env";

let logger: Logger | undefined;

export function getLogger(): Logger {
  if (logger) return logger;
  const env = getEnv();
  logger = pino({
    level: env.NODE_ENV === "test" ? "silent" : "info",
    base: { service: "portfolio-api" },
    ...(env.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty", options: { colorize: true } } }
      : {}),
  });
  return logger;
}

/** Create a child logger with bound context (e.g. requestId). */
export function childLogger(bindings: Record<string, unknown>): Logger {
  return getLogger().child(bindings);
}
