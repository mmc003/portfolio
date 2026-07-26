import { Request, Response, NextFunction } from "express";
import { getLogger } from "../utils/logger";

type Req = Request & { id?: string; startTime?: number };

/** Lightweight structured request logging (avoids a body serializer dep). */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const r = req as Req;
  r.startTime = Date.now();
  const log = getLogger();

  res.on("finish", () => {
    const duration = Date.now() - (r.startTime ?? Date.now());
    log.info({
      requestId: r.id,
      method: r.method,
      url: r.originalUrl ?? r.url,
      status: res.statusCode,
      durationMs: duration,
    });
  });

  next();
}
