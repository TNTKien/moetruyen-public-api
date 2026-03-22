import { Hono } from "hono";

import { isAppError } from "./lib/errors.js";
import { requestIdMiddleware, type AppBindings } from "./lib/request-id.js";
import { jsonError } from "./lib/response.js";
import { mountOpenApiSpec } from "./openapi/spec.js";
import { mountScalarDocs } from "./openapi/scalar.js";
import { genreRoute } from "./routes/genre.route.js";
import { healthRoute } from "./routes/health.route.js";
import { mangaRoute } from "./routes/manga.route.js";
import { searchRoute } from "./routes/search.route.js";

export const app = new Hono<AppBindings>();

app.use("*", requestIdMiddleware);

app.route("/", healthRoute);
app.route("/v1", mangaRoute);
app.route("/v1", genreRoute);
app.route("/v1", searchRoute);

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

  console.error(error);

  return jsonError(
    c,
    {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error",
    },
    500,
  );
});
