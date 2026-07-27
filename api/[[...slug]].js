// Vercel serverless entry — catch-all for /api/* .
//
// Two things matter here:
//
// 1. ROUTING: a file named api/index.js only matches the EXACT path /api. To let
//    the Express app handle /api/health, /api/images, /api/admin/*, etc., this
//    catch-all ([[...slug]]) routes every /api/* path to one function; Express's
//    own router then dispatches by the original URL.
//
// 2. PRE-COMPILED SERVER: the server is built to server/dist by the vercel build
//    step (tsc, under the server's own tsconfig + @types). Requiring the compiled
//    CJS here means @vercel/node never type-checks the server's TypeScript, and
//    the function's dependencies resolve cleanly from server/node_modules.
//
// `module.exports = app` exports the Express application, which @vercel/node
// accepts as a request handler.
const { app } = require("../server/dist/app");

module.exports = app;
