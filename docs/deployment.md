# Production deployment

**Frontend + API → Vercel · Database → Supabase (Postgres) · Images → Cloudflare R2**

The React frontend and the Express API are **one Vercel project**: the static
CRA build is served from the edge, and the API runs as a serverless function
mounted at `/api/*`. Because they share an origin, the frontend calls the API
same-origin (no CORS). All three services have free tiers that cover a personal
portfolio.

```
Browser ──HTML/JS──▶ Vercel (React, static build)
       ──/api/*──▶   Vercel serverless function (Express)
                       │ Prisma (Postgres provider)
                       ▼
                    Supabase (PostgreSQL)
                       │ S3 API
                       ▼
                    Cloudflare R2 (image files, served directly to the browser)
```

The code is identical to local — only environment variables change. The same
Prisma schema runs on SQLite (local) and Postgres (prod); `vercel.json` swaps
the provider to `postgresql` and runs `prisma generate` at build time.

---

## Accounts you'll create (all free)
- **Cloudflare** (R2 object storage) — https://dash.cloudflare.com
- **Supabase** (Postgres) — https://supabase.com
- **Vercel** (frontend + API) — https://vercel.com (sign in with GitHub)

Do them in the order below.

---

## Step 1 — Cloudflare R2 (image storage)

1. Cloudflare dashboard → **R2** → create a bucket, e.g. `portfolio-images`.
2. Enable public access: bucket → **Settings** → **Public access** → enable the
   `*.r2.dev` URL (or attach a custom domain). Note the public URL, e.g.
   `https://pub-abc123def.r2.dev`.
3. Create an API token: **R2 → Manage R2 API Tokens → Create**. Scope = the
   bucket (Object Read & Write). Note:
   - **Access Key ID**
   - **Secret Access Key**
4. Note the **S3 endpoint**: `https://<account_id>.r2.cloudflarestorage.com`
   (shown on the token page / bucket).

You now have: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
`S3_ENDPOINT`, `S3_PUBLIC_BASE_URL`.

---

## Step 2 — Supabase (Postgres database)

1. Create a Supabase project.
2. Connect → **Connection pooling** → **Transaction** mode → copy the pooler
   **connection string** (port **6543**). It looks like:
   ```
   postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
   Append `?pgbouncer=true&connection_limit=1` (recommended for Prisma on
   serverless — one connection per function invocation).
3. This full string is your `DATABASE_URL`.

> Use the **pooler (port 6543)**, not the direct connection (port 5432).
> Serverless functions open many short-lived connections; the pooler prevents you
> from exhausting Supabase's direct-connection limit.

---

## Step 3 — Vercel (frontend + serverless API)

1. Vercel → **Add New → Project** → import your GitHub repo (`mmc003/portfolio`).
   - **Framework Preset:** Create React App (auto-detected; `vercel.json` pins it).
   - **Root Directory:** leave as repo root (the project is a monorepo: CRA at
     root, API in `server/`, function entry at `api/index.ts`).
   - **Build / Install / Output:** already set by `vercel.json`
     (`npm install && npm install --prefix server` →
     `node server/scripts/set-provider.js postgresql && cd server && npx prisma
     generate && cd .. && npm run build` → `build/`).
2. **Environment variables** (Vercel → Settings → Environment Variables; apply to
   **Production** — and Preview if you want):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | *(Supabase pooler string from Step 2)* |
   | `ADMIN_API_TOKEN` | generate with `openssl rand -hex 32` — **required** in prod |
   | `STORAGE_DRIVER` | `s3` |
   | `S3_ENDPOINT` | `https://<acct>.r2.cloudflarestorage.com` |
   | `S3_REGION` | `auto` |
   | `S3_BUCKET` | `portfolio-images` |
   | `S3_ACCESS_KEY_ID` | *(from R2 token)* |
   | `S3_SECRET_ACCESS_KEY` | *(from R2 token)* |
   | `S3_PUBLIC_BASE_URL` | `https://pub-abc123def.r2.dev` |

   Do **not** set `REACT_APP_API_BASE_URL` — leaving it unset makes the frontend
   call `/api/*` same-origin (no CORS). `CORS_ORIGIN` can also stay unset/`*`;
   same-origin requests don't need it.

3. Deploy. Vercel builds the frontend and bundles the `api/index.ts` function
   (tracing imports into `server/src`). When live, verify the API:
   ```
   curl https://<your-project>.vercel.app/api/health
   # {"status":"ok",...}
   ```

> **How the API becomes a function:** `api/index.ts` default-exports the Express
> `app` from `server/src/app.ts`. Importing it does **not** call `app.listen()`
> (that's gated to `require.main === module` in `server/src/index.ts`), so it's
> safe to mount as a serverless handler.

---

## Step 4 — Create the database schema (run locally, once)

The function only runs `prisma generate` (to build the client) — it does **not**
run migrations. Create the tables on Supabase from your laptop.

> **Use the DIRECT connection (port 5432) here, not the pooler.** Prisma can't run
> DDL (`db push`/migrations) through Supabase's transaction-mode pooler
> (PgBouncer) — it errors on prepared statements. The pooler (port 6543) is only
> for the runtime app (Step 5 + the Vercel function). Get the direct string from
> Supabase → **Connect → Session mode** (`db.<ref>.supabase.co:5432`); percent-
> encode any special characters in the password (`$`→`%24`, `+`→`%2B`, `/`→`%2F`).

```bash
cd server
export DATABASE_URL="postgresql://postgres:[PW]@db.<ref>.supabase.co:5432/postgres"
node scripts/set-provider.js postgresql && npx prisma db push --accept-data-loss
# restore local dev afterwards:
node scripts/set-provider.js sqlite && npx prisma generate
unset DATABASE_URL
```

`db push` creates the `Image` table on Supabase from `schema.prisma`.

---

## Step 5 — Import your images into production (run locally, once)

> **Why a local script, not a website upload?** Vercel serverless caps inbound
> request bodies at ~4.5 MB, but source photos can be tens of MB. So images are
> ingested by running the migration script on your laptop, which does the Sharp
> processing locally and uploads directly to R2 + Supabase. (See "Notes" for the
> in-browser upload option if you want it later.)

This uploads everything under `src/imgs` into R2 and writes metadata to Supabase,
using the same pipeline as live uploads. Run from `server/`, temporarily pointing
at prod. (The script recurses into subfolders and uses the first folder name as
the category — e.g. `src/imgs/homepage/*.jpg` → category `homepage`.)

```bash
cd server
export DATABASE_URL="postgresql://...supabase...:6543/postgres?pgbouncer=true&connection_limit=1"
export STORAGE_DRIVER=s3
export S3_ENDPOINT="https://<acct>.r2.cloudflarestorage.com"
export S3_REGION=auto
export S3_BUCKET=portfolio-images
export S3_ACCESS_KEY_ID="<r2 key id>"
export S3_SECRET_ACCESS_KEY="<r2 secret>"
export S3_PUBLIC_BASE_URL="https://pub-abc123def.r2.dev"

node scripts/set-provider.js postgresql && npx prisma generate
npm run migrate:images -- --source ../src/imgs
node scripts/set-provider.js sqlite && npx prisma generate

unset DATABASE_URL STORAGE_DRIVER S3_ENDPOINT S3_REGION S3_BUCKET \
      S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_PUBLIC_BASE_URL
```

Re-running is safe (idempotent — duplicates are skipped). Verify:
```
curl 'https://<your-project>.vercel.app/api/images?limit=3'
# → JSON with items whose sources.* are R2 URLs
```

---

## Step 6 — Verify the full stack

1. Open your Vercel URL — the homepage hero and the Recents galleries load.
2. DevTools → Network: gallery JSON comes from `/api/images` (same origin);
   images come from the R2 URL; both 200.
3. Adding/removing images works against prod (see below).

---

## Adding / removing images in production

Ingestion is from the laptop (Step 5). For ad-hoc changes, the binary-free admin
routes work fine over the serverless API:

- **Publish/unpublish or edit metadata:**
  ```
  curl -X PATCH https://<project>.vercel.app/api/admin/images/<ID> \
    -H "Authorization: Bearer $ADMIN_API_TOKEN" -H "Content-Type: application/json" \
    -d '{"isPublished":true,"title":"Foggy morning"}'
  ```
- **Remove** (deletes the Supabase row + the R2 objects):
  ```
  curl -X DELETE https://<project>.vercel.app/api/admin/images/<ID> \
    -H "Authorization: Bearer $ADMIN_API_TOKEN"
  ```
  Find the ID via `GET /api/images?category=…`.

The multipart upload route `POST /api/admin/images` still exists for local dev,
but on Vercel it will reject files over ~4.5 MB (the platform limit) — use the
script instead.

---

## Notes

- **Serverless + Prisma:** the Prisma client is a module-level singleton
  (`server/src/db/client.ts`), reused across warm invocations. The pooler
  connection string keeps connection churn bounded.
- **Sharp is lazy-loaded:** `imageProcessing.ts` requires Sharp on first use, so
  a function that only serves reads never loads Sharp's native binary. Sharp
  processing happens on your laptop during ingestion, not in the function.
- **Function timeout:** Hobby plan caps functions at ~10 s (`maxDuration` in
  `vercel.json`). Gallery reads and admin metadata/delete calls finish in well
  under that. Pro raises it to 60 s.
- **Cold starts:** the first request after idle spins up the function
  (sub-second to a few seconds). The static frontend shell loads instantly from
  the edge; only the first `/api` call waits for the warm-up.
- **In-browser upload (optional):** if you later want an Upload button on the
  live site, the path is a presigned-URL flow (browser PUTs the original straight
  to R2, then a function processes it). The `ImageStorage.createSignedUploadUrl`
  interface method is the intended hook; it is not implemented yet.
- **R2 free:** 10 GB storage + free egress — far more than a portfolio needs.
- **Total for a hobby portfolio:** **$0/month.**

## Updating the code later
- Push to your branch; Vercel rebuilds frontend + function on every deploy.
- If you change the Prisma schema, re-run `prisma db push` against Supabase from
  your laptop (Step 4) — the function does not migrate at runtime.
