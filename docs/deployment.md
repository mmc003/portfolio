# Production deployment (Option A)

**Frontend → Netlify · Backend → Render · Database → Neon (Postgres) · Images → Cloudflare R2**

All four have free tiers that cover a personal portfolio. The only real caveat is
that Render's free tier **sleeps after ~15 min idle** (~30 s cold start on the
next visit); because the frontend is on Netlify's CDN, the page shell loads
instantly and only the images wait for the backend to wake.

```
Browser ──HTML/JS──▶ Netlify (React, static)
       ──gallery JSON──▶ Render (Express API)
                              │ Prisma
                              ▼
                          Neon (PostgreSQL)
                              │ S3 API
                              ▼
                       Cloudflare R2 (image files)
```

The code is identical to local — only environment variables change. The same
schema runs on SQLite (local) and Postgres (prod) via `scripts/set-provider.js`.

---

## Accounts you'll create (all free)
- **Cloudflare** (R2 object storage) — https://dash.cloudflare.com
- **Neon** (Postgres) — https://neon.tech
- **Render** (Node host) — https://render.com (sign in with GitHub)
- **Netlify** (frontend) — https://netlify.com (sign in with GitHub)

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

## Step 2 — Neon (Postgres database)

1. Create a Neon project → copy the **connection string** (looks like
   `postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require`).
   This is your `DATABASE_URL`.

---

## Step 3 — Render (backend API)

1. Render → **New → Web Service** → connect your GitHub repo (`mmc003/portfolio`).
2. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node (20+)
   - **Build Command:**
     ```
     npm ci && node scripts/set-provider.js && npx prisma generate && npm run build
     ```
   - **Start Command:**
     ```
     npx prisma db push --accept-data-loss && node dist/index.js
     ```
     (`db push` creates the tables on the fresh Neon DB from `schema.prisma`.)
   - **Instance Type:** Free
3. **Environment variables** (Render → Environment):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | *(Neon connection string)* |
   | `ADMIN_API_TOKEN` | generate with `openssl rand -hex 32` — **required** in prod |
   | `STORAGE_DRIVER` | `s3` |
   | `S3_ENDPOINT` | `https://<acct>.r2.cloudflarestorage.com` |
   | `S3_REGION` | `auto` |
   | `S3_BUCKET` | `portfolio-images` |
   | `S3_ACCESS_KEY_ID` | *(from R2 token)* |
   | `S3_SECRET_ACCESS_KEY` | *(from R2 token)* |
   | `S3_PUBLIC_BASE_URL` | `https://pub-abc123def.r2.dev` |
   | `CORS_ORIGIN` | *(your Netlify URL, set after Step 5)* |
   | `PUBLIC_BASE_URL` | *(your Render URL, e.g. `https://xxx.onrender.com`)* |

4. Deploy. When it's live, verify:
   ```
   curl https://<your-render-url>.onrender.com/api/health
   # {"status":"ok",...}
   ```
   Note the Render URL (e.g. `https://portfolio-api.onrender.com`).

> The server derives media URLs from the request host, so `PUBLIC_BASE_URL` is
> optional — but setting it explicitly avoids any proxy/host surprises.

---

## Step 4 — Import your images into production (run locally, once)

This uploads `src/imgs` into R2 and writes metadata to Neon, using the same
pipeline as live uploads. Run from `server/`, temporarily pointing at prod:

```bash
cd server

# point this command at production (overrides server/.env):
export DATABASE_URL="postgresql://...neon...?sslmode=require"
export STORAGE_DRIVER=s3
export S3_ENDPOINT="https://<acct>.r2.cloudflarestorage.com"
export S3_REGION=auto
export S3_BUCKET=portfolio-images
export S3_ACCESS_KEY_ID="<r2 key id>"
export S3_SECRET_ACCESS_KEY="<r2 secret>"
export S3_PUBLIC_BASE_URL="https://pub-abc123def.r2.dev"

# regenerate the Prisma client for Postgres, import, then restore local:
node scripts/set-provider.js postgresql && npx prisma generate
npm run migrate:images -- --source ../src/imgs
npm run migrate:images -- --source ../src/homepage --category homepage
node scripts/set-provider.js sqlite && npx prisma generate

unset DATABASE_URL STORAGE_DRIVER S3_ENDPOINT S3_REGION S3_BUCKET \
      S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_PUBLIC_BASE_URL
```

Re-running is safe (idempotent — duplicates are skipped). Verify by visiting
`https://<render-url>/api/images?limit=3` — you should see your photos with R2 URLs.

---

## Step 5 — Netlify (frontend)

1. Netlify → **Add new site → Import from Git** → pick `mmc003/portfolio`,
   branch **`main`** (merge the feature branch first — see below).
2. Build settings (a `netlify.toml` is already in the repo with these):
   - **Build command:** `npm run build`
   - **Publish directory:** `build`
3. **Environment variables** (Site settings → Environment):
   - `REACT_APP_API_BASE_URL` = `https://<your-render-url>.onrender.com`
4. Deploy. Your site URL looks like `https://<site>.netlify.app`.

> The app uses `HashRouter`, so no SPA redirect rules are needed.

---

## Step 6 — Connect CORS

Back on **Render → Environment**, set:
```
CORS_ORIGIN = https://<your-site>.netlify.app
```
(Redeploy or restart Render so it takes effect.)

---

## Merge the feature branch to main

The new code is on `feat/image-backend`. Before Netlify builds it from `main`,
merge it (open a PR and merge, or fast-forward). Both Netlify and Render deploy
from `main`.

---

## Verify the full stack
1. Open your Netlify URL — the homepage hero and the Recents galleries load.
2. DevTools → Network: gallery JSON comes from the Render URL; images come from
   the R2 URL; both 200.
3. Adding a photo works against prod:
   ```
   curl -X POST https://<render-url>/api/admin/images \
     -H "Authorization: Bearer $ADMIN_API_TOKEN" \
     -F "file=@new.jpg" -F "category=fog" -F "isPublished=true"
   ```

---

## Adding / removing images in production
- **Add:** the `curl` above, or temporarily run `migrate:images` pointed at prod
  (Step 4) for a batch.
- **Remove:** `curl -X DELETE https://<render-url>/api/admin/images/<ID> \
  -H "Authorization: Bearer $ADMIN_API_TOKEN"`. Find the ID via
  `GET /api/images?category=…`.

---

## Cost & cold-start notes
- **Render free** sleeps after ~15 min idle. First hit after sleep takes ~30 s;
  the Netlify-served page shell still appears instantly, only images pause.
  Upgrade Render to a paid instance (~$7/mo) for always-on if it bothers you.
- **Neon free** scales to zero but wakes in <1 s.
- **R2 free**: 10 GB storage + free egress — far more than a portfolio needs.
- Total for a hobby portfolio: **$0/month**.

## Updating the code later
- Push to `main`. Netlify rebuilds the frontend; Render rebuilds the backend.
- If you change the Prisma schema, `db push` in the Render start command applies
  it automatically. (For tracked migrations on Postgres later, regenerate
  migrations against a Postgres DB — out of scope for now.)
