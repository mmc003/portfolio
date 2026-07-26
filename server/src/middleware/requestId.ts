import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

/** Attach a request id (from header or freshly generated) to req + response. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const id = incoming && /^[A-Za-z0-9-_]{1,128}$/.test(incoming) ? incoming : randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
