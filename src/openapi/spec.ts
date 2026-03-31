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
          version: "0.2.0",
          description: [
            "Unofficial read-only REST API for [MoeTruyen](https://moetruyen.net/).",
            "",
            "## Quick start",
            "",
            "Use the `/v1` routes for the current stable surface.",
            "Use the `/v2` manga-family routes for the newer include-based contract.",
            "",
            "## Request notes",
            "",
            "- All API endpoints have a global rate limit of 7 requests per second per IP.",
            "- Include a valid `Origin` header such as `https://suicaodex.com` or `https://moetruyen.net` when making browser-like requests.",
            "- Query parameters such as `sort`, `order`, `genre`, `genrex`, and `include` are documented per route below.",
            "",
            "## Versioning",
            "",
            "- `/v1` preserves the original route contracts.",
            "- `/v2` is the forward-looking surface where manga-family routes share a common base object and optional expansions.",
            "",
            "## Repositories",
            "",
            "- API repo: [TNTKien/moetruyen-public-api](https://github.com/TNTKien/moetruyen-public-api)",
            "- Original site repo: [dex593/web1 (MoeTruyen)](https://github.com/dex593/web1)",
          ].join("\n"),
        },
        servers: [
          {
            url: env.API_BASE_URL,
            description:
              env.NODE_ENV === "production"
                ? "Production"
                : "Local development",
          },
        ],
        tags: [
          { name: "System", description: "Operational endpoints" },
          { name: "Manga", description: "Manga list, detail, ranking, random, and manga-family v2 resources." },
          { name: "Chapters", description: "Chapter reader payloads and manga chapter listings." },
          { name: "Genres", description: "Genre reference data and manga count metadata." },
          { name: "Search", description: "Search endpoints for manga discovery." },
          { name: "Teams", description: "Public translation team list, detail, members, updates, and associated manga." },
          { name: "Users", description: "Public user profile summaries and visible comment activity." },
          { name: "Comments", description: "Recent comments plus manga-level and chapter-level public comment threads." },
        ],
      },
    }),
  );
};
