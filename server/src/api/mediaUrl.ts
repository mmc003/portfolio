/**
 * Resolve the URL prefix for media URLs served by the local adapter.
 *
 * Priority: an explicit PUBLIC_BASE_URL override, otherwise the host the
 * client used to reach this API (works on any port / behind a proxy without
 * configuration). Absolute URLs from the S3 adapter are unaffected.
 */
import { Request } from "express";
import { getEnv } from "../config/env";

export function mediaUrlPrefix(req: Request): string {
  const configured = getEnv().PUBLIC_BASE_URL;
  if (configured && configured.trim().length > 0) {
    return configured.replace(/\/$/, "");
  }
  const proto = req.protocol;
  const host = req.get("host");
  return host ? `${proto}://${host}` : "";
}
