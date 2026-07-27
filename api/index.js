// Vercel serverless entry for the Express API.
//
// ROUTING: a plain api/index.js only matches the exact /api path, so vercel.json
// rewrites every /api/* request here (Vercel passes the ORIGINAL URL to the
// function). Express's own router then dispatches /api/health, /api/images,
// /api/images/:id, /api/admin/*, etc. by that URL.
//
// PRE-COMPILED SERVER: the server is built to server/dist by the vercel build
// step (tsc, under the server's own tsconfig + @types). Requiring the compiled
// CJS here means @vercel/node never type-checks the server's TypeScript, and the
// function's dependencies resolve cleanly from server/node_modules.
//
// `module.exports = app` exports the Express application, which @vercel/node
// accepts as a request handler.
const { app } = require("../server/dist/app");

module.exports = app;
