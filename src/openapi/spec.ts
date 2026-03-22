import type { Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";

import { env } from "../config/env.js";
import type { AppBindings } from "../lib/request-id.js";

export const mountOpenApiSpec = (app: Hono<AppBindings>) => {
  app.get(
    "/openapi.json",
    openAPIRouteHandler(app, {
      documentation: {
        info: {
          title: "Moetruyen Public API",
          version: "0.1.0",
          description: "Read-only public REST API for manga, chapters, genres, and search.",
        },
        servers: [
          {
            url: env.API_BASE_URL,
            description: env.NODE_ENV === "production" ? "Production" : "Local development",
          },
        ],
        tags: [
          { name: "System", description: "Operational endpoints" },
          { name: "Manga", description: "Public manga resources" },
          { name: "Genres", description: "Public genre resources" },
          { name: "Search", description: "Public search resources" },
        ],
      },
    }),
  );
};
