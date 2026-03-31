import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";

import { successEnvelopeSchema } from "../contracts/common.js";
import { genreListItemSchema } from "../contracts/genre.js";
import { CACHE_CONTROL } from "../lib/cache.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";
import { genreService } from "../services/genre.service.js";

export const genreRouteV2 = new Hono<AppBindings>();

genreRouteV2.get(
  "/genres",
  describeRoute({
    tags: ["Genres"],
    summary: "List public genres (v2)",
    description: "Returns public genres with visible manga counts.",
    responses: {
      200: {
        description: "Genre list",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(genreListItemSchema))),
          },
        },
      },
    },
  }),
  async (c) => {
    const items = await genreService.listPublicGenres();

    c.header("Cache-Control", CACHE_CONTROL.genres);

    return jsonSuccess(c, items);
  },
);
