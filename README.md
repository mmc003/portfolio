# Portfolio

A film-photography portfolio: a React frontend backed by a Node/TypeScript API
that serves images from S3-compatible object storage, with generated responsive
derivatives and metadata in a database. Large photos are **not** stored in Git
or the JS bundle — they live in object storage and load on demand.

```
React frontend (CRA/TS) ──fetch──▶ Express API (:4000)
                                      │ Prisma
                                      ▼
                                  Database (SQLite local · PostgreSQL prod)
                                      │
                                      ▼
                          ImageStorage interface
                           ├─ LocalFilesystem  (default dev/test, zero deps)
                           └─ S3 adapter       (S3 / R2 / B2 / MinIO)
                          Sharp @ upload → thumbnail + medium WebP derivatives
```

See `docs/technical-lead-assessment.md` and `docs/adr/001-image-storage-backend.md`
for the full architecture and rationale.

## Repository layout

```
/                # React frontend (Create React App, TypeScript)
  src/           #   components, views, api client, hooks
  public/        #   small static UI assets (favicon, PWA logos) — kept in Git
/server          # Node + TypeScript + Express + Prisma backend
  src/           #   app, routes, services, storage adapters, db, scripts
  prisma/        #   schema + migrations
docker-compose.yml   # optional PostgreSQL + MinIO for prod-parity local dev
.env.example     # documented environment variables (committed; no secrets)
```

Large portfolio media (`src/imgs/`, `src/homepage/`) is **gitignored** — kept
locally only as a migration source.

---

## Quick start (local)

The default local stack needs **no Docker and no external services**: SQLite +
the local filesystem storage adapter.

### 1. Install dependencies

```bash
# frontend (root)
npm install

# backend
npm --prefix server install
```

### 2. Configure the backend

```bash
cp .env.example server/.env
# Edit server/.env — at minimum set a real ADMIN_API_TOKEN for production.
# Defaults work for local dev (SQLite + local filesystem).
```

### 3. Initialize the database

```bash
npm --prefix server run migrate:db     # applies Prisma migrations
```

### 4. Run the backend and frontend

```bash
npm run dev:server   # API on http://localhost:4000   (terminal 1)
npm start            # app  on http://localhost:3000   (terminal 2)
```

The frontend talks to `http://localhost:4000` by default (override with
`REACT_APP_API_BASE_URL` at build/start time).

### 5. Import your existing photos (one-time)

```bash
# Dry-run first:
npm run migrate:images -- --dry-run
# Real run (processes, uploads, writes metadata — never deletes sources):
npm run migrate:images -- --source ./src/imgs
```

### 6. Add a new photo (author workflow)

```bash
curl -X POST http://localhost:4000/api/admin/images \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -F "file=@path/to/photo.jpg" -F "category=fog" -F "isPublished=true"
```

Photos are **unpublished by default** unless you pass `isPublished=true`.

---

## Commands

| Task | Command |
|---|---|
| **Frontend** | |
| Start dev server | `npm start` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Tests | `CI=true npm test` |
| **Backend** (via root `npm run …:server`) | |
| Start dev server | `npm run dev:server` |
| Production build | `npm run build:server` |
| Lint / typecheck | `npm run lint:server` / `npm run typecheck:server` |
| Tests | `npm run test:server` |
| DB migrations | `npm run migrate:db` |
| Import existing photos | `npm run migrate:images -- --source ./src/imgs` |

---

## API

**Public (no auth):**

- `GET /api/health` — liveness probe.
- `GET /api/images?limit=&cursor=&category=&tag=&sort=newest|oldest` — paginated
  published gallery (cursor keyset). Sets `Cache-Control` + `ETag` (304).
  `published` is forced `true`; the public cannot see unpublished images.
- `GET /api/images/:id` — single published image (404 for missing/unpublished).

**Administrative (requires `Authorization: Bearer $ADMIN_API_TOKEN`):**

- `POST   /api/admin/images` — multipart upload + Sharp derivatives.
- `PATCH  /api/admin/images/:id` — update metadata.
- `POST   /api/admin/images/:id/publish` — set `isPublished = true`.
- `DELETE /api/admin/images/:id` — remove record + clean up stored objects.

Upload protections: size limit (`MAX_UPLOAD_SIZE_MB`), real magic-byte signature
check (not the spoofable Content-Type), safe unique object keys (path-traversal
guarded), partial-failure rollback, content-hash dedup.

---

## Environment variables

See `.env.example` (committed, no secrets). Copy to `server/.env`. Key vars:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | API port |
| `PUBLIC_BASE_URL` | `http://localhost:4000` | API's public origin (local adapter URL base) |
| `CORS_ORIGIN` | `*` | Allowed frontend origin(s) (set to your frontend URL in prod) |
| `ADMIN_API_TOKEN` | dev fallback | Secret for `/api/admin/*` (**required in production**) |
| `DATABASE_URL` | `file:./dev.db` | SQLite (local) or PostgreSQL URL (prod) |
| `STORAGE_DRIVER` | `local` | `local` (filesystem) or `s3` |
| `STORAGE_LOCAL_DIR` | `./uploads` | Local adapter root |
| `S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY` | — | S3-compatible settings (when `STORAGE_DRIVER=s3`) |
| `S3_PUBLIC_BASE_URL` | — | CDN/custom base for object URLs |
| `MAX_UPLOAD_SIZE_MB` | `50` | Upload size cap |
| `IMAGE_THUMBNAIL_WIDTH` / `IMAGE_MEDIUM_WIDTH` | `500` / `1600` | Derivative widths |

Validation fails fast at startup with a clear message if required config is
missing/malformed. `.env` is gitignored; only `.env.example` is committed.

---

## Production deployment

**Recommended (free): Netlify (frontend) + Render (backend) + Neon (Postgres) +
Cloudflare R2 (images).** See **`docs/deployment.md`** for the full step-by-step
(env vars, CORS, prod image import, cold-start notes). Summary:

- **Frontend:** any static host (Netlify, Vercel, S3+CloudFront, gh-pages). Build
  with `REACT_APP_API_BASE_URL` pointing at the API. Static hosts cannot run the
  backend — host the backend separately.
- **Backend:** any Node host (Fly.io, Railway, Render, a VM, a container). Set
  all env vars; run `prisma migrate deploy` on deploy.
- **Database:** managed PostgreSQL (RDS, Neon, etc.). Switch the Prisma
  `provider` to `postgresql`, regenerate, and migrate.
- **Object storage:** any S3-compatible bucket (S3, R2, B2) or MinIO. Set
  `STORAGE_DRIVER=s3` and the `S3_*` vars; point `S3_PUBLIC_BASE_URL` at a CDN.
- **CDN:** put a CDN in front of object storage; object keys are content-unique
  and served with `Cache-Control: public, max-age=31536000, immutable`.
- **CORS:** set `CORS_ORIGIN` to the exact frontend origin(s).
- **HTTPS:** terminate TLS at the edge/load balancer for both frontend and API.
- **Backups:** back up the database regularly (metadata). Object storage
  provides its own durability; consider versioning on the bucket.

For a prod-parity local stack, `docker compose up -d postgres minio`.

---

## Migration & rollback

- **Migrate existing images:** `npm run migrate:images` (idempotent; supports
  `--dry-run`; never deletes sources). Verified against this repo: 20/20 photos.
- **Removing old repository images:** they are already gitignored and untracked.
  They remain on disk only. Git history still contains them — it is **not**
  rewritten automatically. To reclaim the 289 MB of history, run BFG or
  `git filter-repo` as a deliberate, separate step.
- **Roll back the frontend to the old image source:** `git revert` the Phase 6
  commit on a branch — the old `require.context` + bundled images are preserved
  in history.
- **Why history is not rewritten automatically:** rewriting is destructive
  (force-push, breaks clones/forks) and out of scope for an automated change.

---

## Security notes

- Public users can **only read**; all writes require the admin token
  (constant-time comparison). The token never appears in frontend source.
- The admin token is a **stopgap**; replace it with a real user-auth system if
  multiple administrators are needed.
- No stack traces leak to clients (generic 500); request ids propagate.
- Magic-byte validation prevents disguised uploads; object keys are sanitized
  and path-traversal guarded.

## Known limitations / future work

- No multi-user authentication (single admin token).
- No signed browser-direct uploads (server-side multipart only, by design).
- No background processing queue (upload is synchronous; fine for current scale).
- Git history not rewritten (289 MB) — documented manual step.
