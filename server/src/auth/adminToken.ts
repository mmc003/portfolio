/**
 * Administrative auth — a constant-time token comparison stopgap.
 *
 * This is intentionally simple: a single shared admin token from the
 * environment. When multiple administrators are needed, replace this with a
 * real user-authentication system (sessions/JWT + per-user credentials). The
 * token is NEVER placed in frontend source; it is only required on /api/admin/*.
 */
import { timingSafeEqual } from "crypto";
import { RequestHandler } from "express";
import { getEnv } from "../config/env";
import { HttpError } from "../middleware/error";

/** Constant-time string equality (lengths are compared first, which is fine). */
export function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Still do a comparison against a same-length buffer to keep timing uniform.
    timingSafeEqual(bb, bb);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** Extract a bearer token from the Authorization header. */
export function extractBearerToken(authHeader: string | undefined): string {
  if (!authHeader) return "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1].trim() : "";
}

/** Express middleware: reject requests without a valid admin bearer token. */
export function requireAdmin(): RequestHandler {
  return (req, _res, next) => {
    const expected = getEnv().ADMIN_API_TOKEN;
    const provided = extractBearerToken(req.header("authorization"));
    if (!provided || !safeEqualString(provided, expected)) {
      next(new HttpError(401, "Authentication required", "unauthorized"));
      return;
    }
    next();
  };
}
