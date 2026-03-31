import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { errorEnvelopeSchema, successEnvelopeSchema } from "../contracts/common.js";
import { mangaV2DetailQuerySchema, mangaV2IdParamsSchema, mangaV2ItemSchema, mangaV2ListQuerySchema, mangaV2RandomQuerySchema, mangaV2SearchQuerySchema, mangaV2TeamMangaQuerySchema, mangaV2TopItemSchema, mangaV2TopQuerySchema } from "../contracts/manga-v2.js";
import { teamIdParamsSchema } from "../contracts/team.js";
import { CACHE_CONTROL } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";
import { getPaginationMeta } from "../lib/pagination.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";
import { validationHook } from "../lib/validation.js";
import { mangaV2Service } from "../services/manga-v2.service.js";

export const mangaRouteV2 = new Hono<AppBindings>();

mangaRouteV2.get(
  "/manga/top",
  describeRoute({
    tags: ["Manga"],
    summary: "List top public manga (v2)",
    description: "Returns paginated top manga using the shared v2 manga base shape. Use `sort_by=views` and `time=24h|7d|30d|all_time` to control the ranking window. Use `include=stats`, `include=genres`, or `include=stats,genres` to expand each manga item.",
    responses: {
      200: {
        description: "Paginated top manga list",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(mangaV2TopItemSchema))),
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
  validator("query", mangaV2TopQuerySchema, validationHook),
  async (c) => {
    const query = c.req.valid("query");
    const result = await mangaV2Service.listTopPublicManga(query);

    c.header("Cache-Control", CACHE_CONTROL.mangaTop);

    return jsonSuccess(c, result.items, {
      pagination: getPaginationMeta({ page: query.page, limit: query.limit }, result.total),
    });
  },
);

mangaRouteV2.get(
  "/manga/random",
  describeRoute({
    tags: ["Manga"],
    summary: "List random public manga (v2)",
    description: "Returns 1 to 10 random public manga items using the shared v2 manga base shape. Use `include=stats`, `include=genres`, or `include=stats,genres` to expand each manga item.",
    responses: {
      200: {
        description: "Random manga list",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(mangaV2ItemSchema))),
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
  validator("query", mangaV2RandomQuerySchema, validationHook),
  async (c) => {
    const query = c.req.valid("query");
    const items = await mangaV2Service.listRandomPublicManga(query);

    c.header("Cache-Control", CACHE_CONTROL.mangaRandom);

    return jsonSuccess(c, items);
  },
);

mangaRouteV2.get(
  "/manga",
  describeRoute({
    tags: ["Manga"],
    summary: "List public manga (v2)",
    description: "Returns paginated public manga using the shared v2 manga base shape. `genre` accepts comma-separated genre ids with OR semantics, `genrex` excludes manga that have any listed genre ids, and `include` controls optional expansions such as `stats` and `genres`.",
    responses: {
      200: {
        description: "Paginated manga list",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(mangaV2ItemSchema))),
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
  validator("query", mangaV2ListQuerySchema, validationHook),
  async (c) => {
    const query = c.req.valid("query");
    const result = await mangaV2Service.listPublicManga(query);

    c.header("Cache-Control", CACHE_CONTROL.mangaList);

    return jsonSuccess(c, result.items, {
      pagination: getPaginationMeta({ page: query.page, limit: query.limit }, result.total),
    });
  },
);

mangaRouteV2.get(
  "/manga/:id",
  describeRoute({
    tags: ["Manga"],
    summary: "Get manga detail (v2)",
    description: "Returns a single manga using the shared v2 manga base shape. Use `include=stats`, `include=genres`, or `include=stats,genres` to expand the response with optional aggregates and genre metadata.",
    responses: {
      200: {
        description: "Manga detail",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(mangaV2ItemSchema)),
          },
        },
      },
      400: {
        description: "Invalid request parameters",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
      404: {
        description: "Manga not found",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("param", mangaV2IdParamsSchema, validationHook),
  validator("query", mangaV2DetailQuerySchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const item = await mangaV2Service.getPublicMangaById(id, query.include);

    if (!item) {
      throw new AppError({
        code: "MANGA_NOT_FOUND",
        message: "Manga not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.mangaDetail);

    return jsonSuccess(c, item);
  },
);

mangaRouteV2.get(
  "/search/manga",
  describeRoute({
    tags: ["Search"],
    summary: "Search public manga (v2)",
    description: "Returns manga search results using the shared v2 manga base shape. Use `q` for the search term, `limit` to control result size, and `include` to request optional `stats` and/or `genres`.",
    responses: {
      200: {
        description: "Search results",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(mangaV2ItemSchema))),
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
  validator("query", mangaV2SearchQuerySchema, validationHook),
  async (c) => {
    const query = c.req.valid("query");
    const items = await mangaV2Service.searchPublicManga(query);

    c.header("Cache-Control", CACHE_CONTROL.search);

    return jsonSuccess(c, items);
  },
);

mangaRouteV2.get(
  "/teams/:id/manga",
  describeRoute({
    tags: ["Teams"],
    summary: "List public team manga (v2)",
    description: "Returns paginated manga associated with a team using the shared v2 manga base shape. `genre` accepts comma-separated genre ids with OR semantics, `genrex` excludes listed genre ids, and `include` controls optional `stats` and `genres` expansions.",
    responses: {
      200: {
        description: "Paginated team manga list",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(mangaV2ItemSchema))),
          },
        },
      },
      400: {
        description: "Invalid request parameters",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
      404: {
        description: "Team not found",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("param", teamIdParamsSchema, validationHook),
  validator("query", mangaV2TeamMangaQuerySchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const result = await mangaV2Service.listPublicTeamMangaByTeamId(id, query);

    if (!result) {
      throw new AppError({
        code: "TEAM_NOT_FOUND",
        message: "Team not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.teamMangaList);

    return jsonSuccess(c, result.items, {
      pagination: getPaginationMeta({ page: query.page, limit: query.limit }, result.total),
    });
  },
);
