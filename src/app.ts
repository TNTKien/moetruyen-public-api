import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";

import { allowedOrigins } from "./config/env.js";
import { normalizeDbError } from "./lib/db-errors.js";
import { isAppError } from "./lib/errors.js";
import { logger, requestLoggerMiddleware } from "./lib/logger.js";
import { setupMonitoring } from "./lib/monitoring.js";
import { globalRateLimitMiddleware } from "./lib/rate-limit.js";
import { requestIdMiddleware, type AppBindings } from "./lib/request-id.js";
import { jsonError } from "./lib/response.js";
import { mountOpenApiSpec } from "./openapi/spec.js";
import { mountScalarDocs } from "./openapi/scalar.js";
import { chapterRoute } from "./routes/chapter.route.js";
import { genreRoute } from "./routes/genre.route.js";
import { healthRoute } from "./routes/health.route.js";
import { mangaRoute } from "./routes/manga.route.js";
import { searchRoute } from "./routes/search.route.js";
import { teamRoute } from "./routes/team.route.js";
import { userRoute } from "./routes/user.route.js";

export const app = new Hono<AppBindings>();

await setupMonitoring(app);

app.use("*", requestIdMiddleware);
app.use(
  "*",
  cors({
    origin: allowedOrigins,
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id"],
  }),
);
app.use("*", requestLoggerMiddleware);

if (globalRateLimitMiddleware) {
  app.use("*", globalRateLimitMiddleware);
}

app.use("/favicon.ico", serveStatic({ path: "./favicon.ico" }));

app.get("/", (c) => c.redirect("/docs", 302));

app.route("/", healthRoute);
app.route("/v1", mangaRoute);
app.route("/v1", chapterRoute);
app.route("/v1", genreRoute);
app.route("/v1", searchRoute);
app.route("/v1", teamRoute);
app.route("/v1", userRoute);

mountOpenApiSpec(app);
mountScalarDocs(app);

app.notFound((c) =>
  jsonError(
    c,
    {
      code: "NOT_FOUND",
      message: "Route not found",
    },
    404,
  ),
);

app.onError((error, c) => {
  if (isAppError(error)) {
    return jsonError(
      c,
      {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      error.status,
    );
  }

  const databaseError = normalizeDbError(error);

  if (databaseError) {
    logger.error("db_request_error", {
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      code: databaseError.code,
      status: databaseError.status,
      details: databaseError.details,
    });

    return jsonError(
      c,
      {
        code: databaseError.code,
        message: databaseError.message,
        ...(databaseError.details ? { details: databaseError.details } : {}),
      },
      databaseError.status,
    );
  }

  logger.error("unhandled_request_error", {
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    error: error instanceof Error ? error.message : String(error),
  });

  return jsonError(
    c,
    {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error",
    },
    500,
  );
});
