// Vercel serverless entry for the portfolio image API.
//
// The Express app is constructed in server/src/app.ts and exported as a singleton
// (`export const app = createApp()`), separate from `app.listen()`, which only
// runs in server/src/index.ts under `require.main === module`. So importing `app`
// here builds the app WITHOUT starting a server — exactly what a serverless
// function needs.
//
// @vercel/node treats `api/*` as functions and routes `/api/*` here; Express's
// own router then dispatches to /api/health, /api/images, /api/admin/*. In local
// dev (STORAGE_DRIVER=local) the app also serves /media/<key>; in production
// (STORAGE_DRIVER=s3) images come straight from R2 and the API only emits JSON.
//
// Default-exporting an Express app is supported by @vercel/node: an Express
// application is itself a valid Node request handler.
import { app } from "../server/src/app";

export default app;
