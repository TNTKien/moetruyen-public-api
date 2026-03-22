import { serve } from "@hono/node-server";

import { env } from "./config/env.js";
import { app } from "./app.js";

const server = serve({
  fetch: app.fetch,
  port: env.PORT,
  hostname: "0.0.0.0",
});

console.log(`Moetruyen Public API listening on http://localhost:${env.PORT}`);
console.log(`OpenAPI spec: http://localhost:${env.PORT}/openapi.json`);
console.log(`Scalar docs: http://localhost:${env.PORT}/docs`);

const shutdown = () => {
  server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
