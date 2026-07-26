/**
 * Opaque, base64url cursor encoding for keyset pagination.
 *
 * The cursor carries the last row's (createdAt, id) so the next page can be
 * fetched with a stable, gap-free keyset — even under concurrent inserts.
 */

export interface CursorPayload {
  createdAt: string; // ISO
  id: string;
}

function toBase64Url(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}

function fromBase64Url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function encodeCursor(payload: CursorPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

/** Decode + validate. Returns null for missing/invalid cursors (first page). */
export function decodeCursor(raw: string | null | undefined): CursorPayload | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Partial<CursorPayload>;
    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      Number.isNaN(Date.parse(parsed.createdAt))
    ) {
      return null;
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    return null;
  }
}
