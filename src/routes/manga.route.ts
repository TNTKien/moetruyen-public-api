import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { errorEnvelopeSchema, successEnvelopeSchema } from "../contracts/common.js";
import { mangaChapterListSchema } from "../contracts/chapter.js";
import { mangaDetailSchema, mangaIdParamsSchema, mangaListItemSchema, mangaListQuerySchema, mangaRandomQuerySchema } from "../contracts/manga.js";
import { AppError } from "../lib/errors.js";
import { CACHE_CONTROL } from "../lib/cache.js";
import { getPaginationMeta } from "../lib/pagination.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";
import { validationHook } from "../lib/validation.js";
import { chapterService } from "../services/chapter.service.js";
import { mangaService } from "../services/manga.service.js";

export const mangaRoute = new Hono<AppBindings>();

mangaRoute.get(
  "/manga/random",
  describeRoute({
    tags: ["Manga"],
    summary: "List random public manga",
    description: "Returns 1 to 10 random public manga items using the standard manga list item shape.",
    responses: {
      200: {
        description: "Random manga list",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(mangaListItemSchema))),
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
  validator("query", mangaRandomQuerySchema, validationHook),
  async (c) => {
    const query = c.req.valid("query");
    const items = await mangaService.listRandomPublicManga(query);

    c.header("Cache-Control", CACHE_CONTROL.mangaRandom);

    return jsonSuccess(c, items);
  },
);

mangaRoute.get(
  "/manga",
  describeRoute({
    tags: ["Manga"],
    summary: "List public manga",
    description: "Returns paginated public manga results with optional search, genre, status, and sort filters.",
    responses: {
      200: {
        description: "Paginated manga list",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(mangaListItemSchema))),
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
  validator("query", mangaListQuerySchema, validationHook),
  async (c) => {
    const query = c.req.valid("query");
    const result = await mangaService.listPublicManga(query);

    c.header("Cache-Control", CACHE_CONTROL.mangaList);

    return jsonSuccess(c, result.items, {
      pagination: getPaginationMeta({ page: query.page, limit: query.limit }, result.total),
    });
  },
);

mangaRoute.get(
  "/manga/:id",
  describeRoute({
    tags: ["Manga"],
    summary: "Get manga detail",
    description: "Returns the public manga detail payload for a manga id.",
    responses: {
      200: {
        description: "Manga detail",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(mangaDetailSchema)),
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
  validator("param", mangaIdParamsSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const item = await mangaService.getPublicMangaById(id);

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

mangaRoute.get(
  "/manga/:id/chapters",
  describeRoute({
    tags: ["Manga"],
    summary: "List public manga chapters",
    description: "Returns public chapter metadata for a manga id ordered by latest chapter first.",
    responses: {
      200: {
        description: "Manga chapters",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(mangaChapterListSchema)),
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
  validator("param", mangaIdParamsSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const item = await chapterService.listPublicChaptersByMangaId(id);

    if (!item) {
      throw new AppError({
        code: "MANGA_NOT_FOUND",
        message: "Manga not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.mangaChapters);

    return jsonSuccess(c, item);
  },
);
