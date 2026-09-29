// Vercel function: the NestJS API (compiled to apps/api/dist by `pnpm vercel-build`).
// Every /api/* request is rewritten here (vercel.json); Express still sees the original URL.
module.exports = require("../apps/api/dist/serverless").default;
