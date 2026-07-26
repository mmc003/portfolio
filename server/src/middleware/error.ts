import { Request, Response, NextFunction } from "express";
import { getLogger } from "../utils/logger";

type Req = Request & { id?: string };

/** 404 handler — placed after all routes. */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "not_found", message: `Route not found: ${req.method} ${req.path}` },
  });
}

/**
 * Application-level error types. Anything thrown in a route/middleware that is
 * an instance of HttpError is reported to the client with its status; all other
 * errors are logged with a stack and reported as a generic 500 (no stack leak).
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "error"
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const r = req as Req;
  const log = getLogger();

  if (err instanceof HttpError) {
    log.warn({ requestId: r.id, code: err.code, status: err.status, message: err.message });
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  const message = err instanceof Error ? err.message : String(err);
  log.error({
    requestId: r.id,
    message,
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({
    error: {
      code: "internal_error",
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : message,
    },
  });
}
