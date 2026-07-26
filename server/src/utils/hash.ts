import { createHash } from "crypto";

/** SHA-256 hex of a buffer, used for dedup / migration idempotency. */
export function sha256Hex(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}
