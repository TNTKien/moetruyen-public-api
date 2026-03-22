import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { errorEnvelopeSchema, successEnvelopeSchema } from "../contracts/common.js";
import { searchMangaItemSchema, searchMangaQuerySchema } from "../contracts/search.js";
import { CACHE_CONTROL } from "../lib/cache.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";
import { validationHook } from "../lib/validation.js";
import { searchService } from "../services/search.service.js";

export const searchRoute = new Hono<AppBindings>();

searchRoute.get(
  "/search/manga",
  describeRoute({
    tags: ["Search"],
    summary: "Search public manga",
    description: "Returns lightweight public manga search results for a query string.",
    responses: {
      200: {
        description: "Search results",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(searchMangaItemSchema))),
          },
        },
      },
      400: {
        description: "Invalid query parameters",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("query", searchMangaQuerySchema, validationHook),
  async (c) => {
    const query = c.req.valid("query");
    const items = await searchService.searchPublicManga(query);

    c.header("Cache-Control", CACHE_CONTROL.search);

    return jsonSuccess(c, items);
  },
);
