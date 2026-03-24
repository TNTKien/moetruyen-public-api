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
          description: [
            "Unofficial read-only REST API for [MoeTruyen](https://moetruyen.net/).",
            "",
            "Full features will be added in the future (chắc thế)",
            "",
            "- Github: [TNTKien/moetruyen-public-api](https://github.com/TNTKien/moetruyen-public-api)",
            "- Note: All API endpoints have a global rate limit of 7 requests per second per IP.",
          ].join("\n"),
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
          { name: "Chapters", description: "Public chapter reader resources" },
          { name: "Genres", description: "Public genre resources" },
          { name: "Search", description: "Public search resources" },
          { name: "Teams", description: "Public translation team resources" },
          { name: "Users", description: "Public user profile resources" },
        ],
      },
    }),
  );
};
