# ADR 001: Image storage backend

**Status:** Accepted
**Date:** 2026-07-26

## Context

The portfolio was a static Create React App that bundled full-resolution
photographs into the Git repository and the JS build via Webpack
`require.context`. Measured at the start of this work:

- `src/imgs` + `src/homepage`: ~119 MB of JPEGs (20 portfolio photos).
- `.git`: 289 MB (large binaries + past `build/static/media` blobs in history).
- Every gallery visitor downloaded multi-megabyte originals (worst: 29 MB) with
  no thumbnails, no responsive `srcset`, no lazy loading, and layout shift.

The goal is to make image storage scalable and the gallery fast, without being
locked to one vendor and without a disruptive rewrite.

## Decision

Introduce a Node/TypeScript backend that stores image binaries in
S3-compatible object storage and their metadata in a relational database, and
drive the React gallery from a paginated, cached public API. Large images are
removed from Git and the bundle.

### Why images should not remain in Git

Git is optimized for text, not multi-megabyte binaries. Committing photos
bloats clone/push time, the deploy artifact, and `.git` indefinitely. Object
storage is cheap, serves bytes over CDN, and keeps the source repository small.

### Why object storage

Purpose-built for large immutable binaries: HTTP range requests, CDN caching,
virtually unlimited scale, and pay-per-use. Image bytes never touch the
application server or database.

### Why storage is abstracted (vendor-neutral)

The final provider is not yet chosen. All storage code sits behind an
`ImageStorage` interface (`upload` / `delete` / `getPublicUrl`) with two
adapters: a local filesystem adapter (default for dev/test, zero external
services) and an S3 adapter (`@aws-sdk/client-s3`) that works with AWS S3,
Cloudflare R2, Backblaze B2, and MinIO. Swapping providers is a configuration
change plus a one-line adapter selection, not an application rewrite.

### Why Express (not Fastify)

Express has the broadest ecosystem and the simplest mental model, and it is
fully compatible with the CRA-era TypeScript toolchain already in the repo.
Fastify (faster, native schema validation) was considered; Express was chosen
for simplicity and breadth, which outweighed raw throughput at this scale.

### Why Prisma with SQLite (local) + PostgreSQL (prod)

Prisma gives one strongly-typed schema and a single data-access layer. SQLite
makes the **entire stack runnable and testable with zero external services**
(fast, file-based, no Docker), while PostgreSQL is the production default. The
schema uses only portable features (no scalar lists, no provider-specific
types), so the same schema targets both — production swaps the Prisma provider
and re-runs migrations.

### Why cursor (keyset) pagination (not offset)

Cursor pagination on `(createdAt, id) DESC` is stable under concurrent inserts
(no skipped/duplicated rows as new images arrive) and scales to thousands of
rows. It also maps naturally onto the gallery's infinite-load UI. Offset
pagination is simpler but degrades and shifts under writes.

### Why derivatives are generated at upload time (not per request)

Sharp runs once when an image is ingested, producing a ~500px thumbnail and a
~1600px medium in WebP (plus a dominant color and a base64 blur placeholder).
Serving is then a static read from immutable, content-unique object keys
(cacheable forever). Per-request processing would burn CPU on every view and
defeat caching.

## Alternatives considered

- **Stay static (keep images in Git):** rejected — does not address scale,
  clone time, or payload.
- **Image CDN with on-the-fly transforms (Cloudinary/imgix):** viable for
  production but adds a vendor dependency and per-request cost; the current
  upload-time derivative approach is provider-independent and cache-friendly.
- **Fastify:** see above.
- **Offset pagination:** see above.
- **Direct browser-to-storage uploads (signed URLs):** optional extension; the
  initial upload path is server-side multipart, which is simpler and keeps
  processing/rollback centralized. The `ImageStorage` interface reserves an
  optional `createSignedUploadUrl` method for later.

## Consequences

- A backend process, database, and object-storage bucket are now required to
  serve the gallery (deployment model changed from static-only).
- Large images are no longer in the application bundle or tracked going
  forward; Git history is **not** rewritten automatically (BFG / `git
  filter-repo` is documented as a separate, optional manual step).
- The local filesystem + SQLite defaults keep local development dependency-free.
