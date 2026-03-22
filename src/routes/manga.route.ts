import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { errorEnvelopeSchema, successEnvelopeSchema } from "../contracts/common.js";
import { chapterReaderParamsSchema, chapterReaderSchema, mangaChapterListSchema } from "../contracts/chapter.js";
import { mangaDetailSchema, mangaListItemSchema, mangaListQuerySchema, mangaSlugParamsSchema } from "../contracts/manga.js";
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
  "/manga/:slug",
  describeRoute({
    tags: ["Manga"],
    summary: "Get manga detail",
    description: "Returns the public manga detail payload for a slug.",
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
  validator("param", mangaSlugParamsSchema, validationHook),
  async (c) => {
    const { slug } = c.req.valid("param");
    const item = await mangaService.getPublicMangaBySlug(slug);

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
  "/manga/:slug/chapters",
  describeRoute({
    tags: ["Manga"],
    summary: "List public manga chapters",
    description: "Returns public chapter metadata for a manga slug ordered by latest chapter first.",
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
  validator("param", mangaSlugParamsSchema, validationHook),
  async (c) => {
    const { slug } = c.req.valid("param");
    const item = await chapterService.listPublicChaptersByMangaSlug(slug);

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

mangaRoute.get(
  "/manga/:slug/chapters/:chapterId/pages",
  describeRoute({
    tags: ["Manga"],
    summary: "Get chapter reader payload",
    description: "Returns chapter reader metadata, page URLs, and adjacent chapter links for a public chapter.",
    responses: {
      200: {
        description: "Reader payload",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(chapterReaderSchema)),
          },
        },
      },
      404: {
        description: "Chapter not found",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("param", chapterReaderParamsSchema, validationHook),
  async (c) => {
    const { slug, chapterId } = c.req.valid("param");
    const item = await chapterService.getPublicChapterReaderById(slug, chapterId);

    if (!item) {
      throw new AppError({
        code: "CHAPTER_NOT_FOUND",
        message: "Chapter not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.mangaChapters);

    return jsonSuccess(c, item);
  },
);
