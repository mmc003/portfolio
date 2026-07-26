# Phase 1 — Technical Lead Assessment

> Engineering log entry. Evidence-based, written from direct repository inspection.

## 1. Current architecture (as found)

| Aspect | Finding |
|---|---|
| Build tool / framework | **Create React App** (`react-scripts@5.0.1`, Webpack 5 under the hood). Not ejected. |
| Language | **TypeScript** (`typescript@4.9.5`, `strict: true`), React 18.3.1, `react-router-dom@6.28.0` using **HashRouter**. |
| Package manager | **npm** (`package-lock.json`, no yarn/pnpm). |
| Deployment target | **Static host** — current scripts target `gh-pages` (`npm run deploy` → `gh-pages -d build`). Navbar also links to a Netlify "SWE" site. |
| Test setup | CRA default Jest (`@testing-library/react`). The single `App.test.tsx` looks for `learn react` text that **does not exist** in the app → it is a broken default test. |
| Backend / DB / storage | **None.** Pure static frontend today. |

## 2. Current image flow (the core problem)

- `src/views/Recents.tsx` calls Webpack's `require.context("../imgs/<category>", false, /\.(png|jpe?g|svg)$/)` for each of four folders: `dujiangyan`, `vancouver`, `fog`, `danang-boats`.
- `require.context` makes Webpack **bundle every matched image** into the build output (`build/static/media/...`) at **full resolution, no derivatives**.
- `src/components/ImageGallery.tsx` is a carousel that renders one full-resolution `<img>` at a time (`max-width: 800px` via CSS, but the browser still downloads the multi-megabyte original).
- `src/views/Home.tsx` statically imports one large homepage image (`src/homepage/000032190025.jpg`, ~4.1 MB).
- **No lazy loading, no `srcset`/`<picture>`, no thumbnails, no aspect-ratio reservation** → every gallery visitor pulls dozens of MB and the layout shifts as each original loads.

## 3. Measured image footprint (evidence)

```
src/imgs (portfolio)  : 115 MB across 20 JPEGs   (dujiangyan 4, vancouver 7, fog 4, danang-boats 5)
src/homepage          :   4.1 MB (1 JPEG)
.git                  : 289 MB  (bloated by committed binaries + past build/static/media blobs)
```

Largest committed binaries (current tree):
- `danang-boats/img1.jpg` 29.3 MB, `img2.jpg` 28.4 MB, `dujiangyan/*` ~7.5 MB each.

Largest objects in **git history** (committed build artifacts):
- `static/media/000032210013.*.jpg` 29.9 MB, `000032210008` 29.7 MB, `000032190025` 27.2 MB, `000000000000` 28.8 MB.

[Technical Lead] Finding: The repository doubles as a photo archive. Clone size, deploy artifact size, and gallery payload are all dominated by full-resolution JPEGs that have **no business being in source control or the JS bundle.** `.git` alone is 2.5× larger than the working image set because large binaries were committed and rebuilt repeatedly.

## 4. Deployment assumptions to revisit

- A static-only host (gh-pages/Netlify static) **cannot** run the backend this task requires. The completed system assumes at least one always-on process (Node API) + a database + object storage. This is an explicit, documented change to the deployment model.
- HashRouter is currently used; that survives a static frontend, but once the frontend talks to a backend we will use a configurable `API_BASE_URL` so the same build can target dev (`localhost:4000`) and prod.

## 5. Target architecture

```
React frontend (CRA/TS, HashRouter)
   │  fetch JSON gallery API (axios-free, thin client + data hook)
   ▼
Backend API  (Node + TypeScript + Express)   :4000
   │  Prisma client
   ▼
Database  (SQLite local/test, PostgreSQL prod)
   │
   ▼
Object storage abstraction (ImageStorage interface)
   ├── LocalFilesystemStorage  (default dev/test driver — zero external deps)
   └── S3Storage               (@aws-sdk/client-s3 → S3 / R2 / B2 / MinIO)

Sharp (server-side)  →  thumbnail + medium WebP derivatives at upload time
```

## 6. Key technical decisions (rationale in `docs/adr/001-*.md`)

| Decision | Choice | Why |
|---|---|---|
| Backend framework | **Express** | Widest ecosystem, simplest mental model, best compatibility with the CRA-era TS toolchain already in the repo. Fastify was considered (faster, native schema) but Express minimizes friction for this scope. |
| Validation | **Zod** | Shared TS types + runtime validation + env parsing from one source. |
| ORM / DB | **Prisma**, **SQLite** (local/test) + **PostgreSQL** (prod) | One schema targets both; SQLite makes the **entire stack runnable and testable with zero external services**; PostgreSQL is the production default. |
| Storage local driver | **LocalFilesystemStorage** | Repo currently has **no Docker dependency**; a local adapter maximizes test reliability and onboarding speed while the production design stays S3-compatible. |
| Storage prod driver | **S3Storage** (`@aws-sdk/client-s3`) | One code path serves S3, R2, B2, MinIO. |
| Image processing | **Sharp** → WebP derivatives (thumbnail ~500px, medium ~1600px), JPEG master preserved/optimized, EXIF stripped, auto-orient. | Derivatives at upload = no per-request processing. |
| Pagination | **Cursor (keyset)** on `(createdAt, id) DESC` | Stable under concurrent inserts; natural fit for infinite-load gallery; scales to thousands without rewrite. |
| Backend tests | **Vitest + supertest** | Fast, native TS, modern. |
| Frontend tests | **Jest via `react-scripts test`** | CRA is Jest-based; adding a second runner is needless friction. |
| Monorepo layout | Frontend stays at repo root; add `server/`. | Avoids reorganizing the existing CRA app. |

## 7. Migration phasing (small, reversible)

See the task list / phase gates. Each phase has an explicit quality gate and is independently committable. Highlights:

1. **Discovery** (this doc + ADR).
2. Backend skeleton — health, env, logging, error MW, graceful shutdown + tests.
3. DB + storage abstraction (interface + 2 adapters) + tests.
4. Upload pipeline (auth → validate → Sharp → store → DB → rollback) + integration tests.
5. Public gallery API (cursor pagination, filters, caching) + tests.
6. React integration (API client, responsive, states, no CLS) + frontend tests.
7. Idempotent migration script (`migrate:images`, `--dry-run`) — **never deletes sources**.
8. DevOps: `.env.example`, Docker/Compose (MinIO + Postgres), CI workflow, README, ADR, rollback.
9. Final regression: full suites + production builds + diff review + report.

[Technical Lead] Decision: The existing images and the old `require.context` flow are **kept intact and functional until Phase 6 verifies the API path**, and sources are **never deleted automatically**. Rollback to the old flow is one `git revert` / branch switch.

## 8. Risks

- [Technical Lead] Risk: `.git` is already 289 MB from history. We will **not rewrite history automatically**; `git filter-repo`/BFG instructions are documented for when the owner chooses.
- [Technical Lead] Risk: Node v25 is very new — some tooling may lag. Mitigation: pin engine range, prefer stable deps; if a Sharp prebuilt is missing for the host, fall back is documented.
- [Technical Lead] Risk: Changing the deployment model from static to backend+DB+storage. Documented as an explicit assumption with rollback path.

## 9. Acceptance criteria (carry forward)

Repository (no large binaries in bundle/git-tracked), Backend (starts, health, secure upload, derivatives, metadata, pagination, protected admin, swappable storage), Frontend (API-driven, lazy, responsive, states, minimal CLS), Migration (documented, dry-run, idempotent, no auto-delete), Quality (lint/type/test/build/e2e pass; docs complete). Each is checked off in the final report.
