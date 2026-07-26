# Final Implementation Report

Portfolio image-backend migration. Branch `feat/image-backend`. All phases
complete and verified unless explicitly noted.

## 1. Repository assessment (before)

A static **Create React App** (TypeScript, `react-scripts`, HashRouter, npm,
gh-pages deploy) that bundled **full-resolution photographs into Git and the JS
build** via Webpack `require.context` in `src/views/Recents.tsx` (4 category
folders) and a static import in `src/views/Home.tsx`.

Problems (measured):
- `src/imgs` (20 JPEGs) + `src/homepage`: **~119 MB** committed.
- `.git`: **289 MB** (binaries + past `build/static/media` blobs in history).
- Gallery shipped originals to every visitor (worst 29 MB), with no thumbnails,
  responsive `srcset`, lazy loading, or aspect-ratio reservation → layout shift.
- No backend, database, storage, CI, `.env`, or fetch layer.

## 2. Architecture implemented

```
React frontend (CRA/TS)  ──fetch JSON──▶  Express API (:4000)
  • API client + useGallery hook              • Public gallery API (paginated,
  • ResponsiveImage (srcset/lazy/aspect-ratio)   cached, ETag) + token-gated
  • loading/empty/error/load-more states         admin upload/CRUD
                                                  • Sharp derivatives at upload
                                                  ▼
                                            Prisma  (SQLite local · PostgreSQL prod)
                                                  ▼
                                            ImageStorage interface
                                             ├─ LocalFilesystemStorage (default dev/test)
                                             └─ S3Storage (S3 / R2 / B2 / MinIO)
                                            object keys are content-unique → immutable cache
```

- **Frontend:** API-driven; no bundled photos. Build dropped from ~120 MB to
  **1.1 MB** (only the two small PWA logos in `public/` remain).
- **Backend:** Express + Zod, helmet, CORS, compression, request-id, structured
  logging, central error handler (no stack leaks), graceful shutdown.
- **Database:** Prisma `Image` model (portable SQLite/Postgres); keyset cursor
  pagination on `(createdAt, id)`.
- **Storage abstraction:** `ImageStorage` interface + local-fs + S3 adapters,
  selected via `STORAGE_DRIVER`.
- **Upload flow:** auth → size/magic-byte validation → Sharp (auto-orient, strip
  EXIF, thumbnail ~500px + medium ~1600px WebP, dominant color, blur
  placeholder) → store master+derivatives → persist metadata, with
  partial-failure rollback and content-hash dedup.
- **Caching:** list/detail `Cache-Control` + automatic `ETag`/304; object keys
  immutable (`max-age=31536000, immutable`); upload-time derivatives (never
  per-request); paginated DB queries with indexes.

## 3. Team workflow review

- **Technical Lead:** documented current architecture, measured the 119 MB / 289
  MB footprint, defined the target architecture and 9-phase plan with quality
  gates and reversible steps.
- **Backend Engineer:** Express factory (testable via `supertest`), Zod env
  validation, keyset pagination, storage interface with two adapters, upload
  pipeline with rollback, request-id/structured logging/graceful shutdown.
- **Frontend Engineer:** thin API client + cancellable `useGallery` hook (no new
  deps), `ResponsiveImage` (srcset/lazy/aspect-ratio/blur), refactored
  carousel/views **preserving the original styling and titles**.
- **DevOps Engineer:** root convenience scripts, `.env.example`, `docker-compose`
  (Postgres + MinIO), GitHub Actions CI (no secrets needed), README + ADR,
  untracked large media.
- **Security Engineer:** constant-time admin token; magic-byte validation (not
  Content-Type); path-traversal-guarded object keys; size cap; public routes
  force `published=true`; no secrets/stack traces to clients; CORS configurable.
- **QA Engineer:** 103 backend + 9 frontend tests; real-HTTP smokes for health,
  upload→serve, migration (20/20), and gallery serving WebP derivatives.
- **Final Reviewer:** full suites + builds green; diff clean (no tracked images,
  no secrets, no build artifacts); see limitations below.

## 4. Files changed (notable)

**Frontend (new):** `src/api/{client,types}.ts`, `src/hooks/useGallery.ts`,
`src/components/{ResponsiveImage,CategoryGallery}.tsx`, tests.
**Frontend (rewritten):** `src/components/ImageGallery.tsx`,
`src/views/{Recents,Home}.tsx`, CSS, `src/global.d.ts` (trimmed), `src/App.test.tsx`.
**Backend (new):** `server/src/{app,index}.ts`, `config/env.ts`,
`middleware/{requestId,requestLogger,error}.ts`, `routes/{health,gallery,admin}.ts`,
`services/{imageProcessing,uploadService}.ts`, `storage/{types,objectKey,local-fs,s3,index}.ts`,
`db/{client,cursor,imageRepository}.ts`, `validation/upload.ts`, `auth/adminToken.ts`,
`api/dto.ts`, `utils/{logger,asyncHandler,hash}.ts`, `scripts/migrate-images.ts`,
`prisma/{schema.prisma,migrations/}`.
**Infra/docs:** `.github/workflows/ci.yml`, `docker-compose.yml`, `.env.example`,
`.gitignore`, `README.md`, `docs/{technical-lead-assessment,adr/001,final-report}.md`.
**Removed from tracking:** `src/imgs/**` (20 photos), `src/homepage/**` (kept on disk).

## 5. Tests executed

| Command | Result | Important output |
|---|---|---|
| `cd server && npm run lint` | ✅ pass | no errors |
| `cd server && npm run typecheck` | ✅ pass | no errors |
| `cd server && npm run build` | ✅ pass | `dist/` emitted |
| `cd server && npm test` | ✅ pass | **103/103** tests, 15 files |
| `npm run lint` (frontend) | ✅ pass | no errors |
| `CI=true npm test` (frontend) | ✅ pass | **9/9** tests, 3 files |
| `npm run build` (frontend) | ✅ pass | 57 KB JS / 1.6 KB CSS; **no images** in bundle |
| Smoke: `GET /api/health` (live) | ✅ pass | 200 `{status:"ok"}` + request-id echo |
| Smoke: upload → serve derivatives (live) | ✅ pass | original/medium/thumbnail 200 + immutable cache |
| Smoke: unauthorized admin upload | ✅ pass | 401 |
| `npm run migrate:images` (real) | ✅ pass | 20/20 migrated, 60 derivatives, 0 failed |
| Smoke: gallery serves real WebP | ✅ pass | Vancouver medium 408 KB, `image/webp`, 20 published |
| `npm audit` (frontend & backend) | ⚠️ could not run locally | npm 11 failed to decode the registry's gzipped advisories payload (environment/registry issue, not a dependency issue). CI runs the audit on GitHub runners. The one previously-known vuln (multer 1.x) was remediated by bumping to 2.x. |

## 6. Migration result

- **Discovered:** 20 images
- **Migrated:** 20
- **Skipped:** 0 (no prior duplicates)
- **Failed:** 0
- **Duplicates detected:** 0
- **Mode:** real migration (dry-run run first)
- Categories preserved: vancouver 7, fog 4, dujiangyan 4, danang-boats 5.
- Source files untouched; 60 derivative objects written to local storage.

## 7. Security review

- **Upload protections:** size cap (`MAX_UPLOAD_SIZE_MB`); real magic-byte
  signature sniffing (jpeg/png/webp/avif) that overrides the spoofable
  Content-Type; safe, content-unique object keys with path-traversal guards.
- **Authentication:** constant-time admin bearer token for all `/api/admin/*`;
  public routes are read-only and force `published=true`.
- **Secret handling:** token and DB/storage creds live only in `server/.env`
  (gitignored); `.env.example` carries placeholders; no secrets in frontend.
- **CORS:** configurable (`CORS_ORIGIN`); default `*` for local dev.
- **Limitations:** single shared admin token (no multi-user auth); server-side
  multipart only (no signed browser-direct uploads yet, by design).

## 8. Performance improvements

- **Initial gallery download:** carousel loads only the **medium** (~1600px WebP)
  of the active slide via `srcset`; off-screen slides aren't mounted; lazy by
  default. A 1.2 MB original becomes a ~400 KB medium.
- **Responsive variants:** `srcset` (thumbnail 500w / medium 1600w / original)
  lets the browser pick; thumbnails available for grids.
- **Pagination:** cursor keyset (no skip/dupes under concurrent inserts).
- **Caching:** list/detail `Cache-Control` + ETag/304; immutable object keys for
  derivatives; upload-time processing (no per-request Sharp).
- **Bundle:** ~120 MB of photos → **1.1 MB** total; `.git` no longer grows with
  new photos. Clones/deploys are dramatically smaller and faster.

## 9. Remaining work / limitations

- `npm audit` could not run in this environment (registry encoding issue); CI
  runs it. No other known high-severity issues; multer bumped to 2.x.
- No browser E2E (Playwright). The full workflow is covered by integration tests
  (upload→process→store→DB→gallery API) + Jest component tests; a real-browser
  E2E is the recommended next addition if desired.
- No multi-user auth / signed direct uploads / background processing queue
  (documented, by design for current scope).
- Git history (289 MB) was **not** rewritten; BFG/`git filter-repo` is a
  documented manual step.
- Production cloud resources are documented, not provisioned (no real secrets).

## 10. Exact startup commands

```bash
# one-time setup
npm install
npm --prefix server install
cp .env.example server/.env            # edit ADMIN_API_TOKEN for prod
npm --prefix server run migrate:db

# import existing photos (one-time)
npm run migrate:images -- --dry-run
npm run migrate:images -- --source ./src/imgs

# run
npm run dev:server                     # API  http://localhost:4000  (terminal 1)
npm start                              # app  http://localhost:3000  (terminal 2)

# add a new photo
curl -X POST http://localhost:4000/api/admin/images \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -F "file=@photo.jpg" -F "category=fog" -F "isPublished=true"

# checks
npm run lint && CI=true npm test && npm run build              # frontend
npm --prefix server run lint && npm --prefix server run typecheck && npm --prefix server test && npm --prefix server run build
```
