import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";

import { chapterListQuerySchema, chapterReaderParamsSchema, chapterReaderSchema, mangaChapterAggregateListSchema, mangaChapterListSchema } from "../contracts/chapter.js";
import { errorEnvelopeSchema, successEnvelopeSchema } from "../contracts/common.js";
import { mangaIdParamsSchema } from "../contracts/manga.js";
import { CACHE_CONTROL } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";
import { getPaginationMeta } from "../lib/pagination.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";
import { validationHook } from "../lib/validation.js";
import { chapterService } from "../services/chapter.service.js";

export const chapterRouteV2 = new Hono<AppBindings>();

chapterRouteV2.get(
  "/manga/:id/chapters",
  describeRoute({
    tags: ["Manga"],
    summary: "List public manga chapters (v2)",
    description: "Returns paginated public chapter metadata for a manga id ordered by latest chapter first.",
    responses: {
      200: {
        description: "Manga chapters",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(mangaChapterListSchema)),
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
  validator("param", mangaIdParamsSchema, validationHook),
  validator("query", chapterListQuerySchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const item = await chapterService.listPublicChaptersByMangaId(id, query);

    if (!item) {
      throw new AppError({
        code: "MANGA_NOT_FOUND",
        message: "Manga not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.mangaChapters);

    return jsonSuccess(
      c,
      {
        manga: item.manga,
        chapters: item.chapters,
      },
      {
        pagination: getPaginationMeta({ page: query.page, limit: query.limit }, item.total),
      },
    );
  },
);

chapterRouteV2.get(
  "/manga/:id/chapters/aggregate",
  describeRoute({
    tags: ["Manga"],
    summary: "List aggregate manga chapters (v2)",
    description: "Returns the full lightweight chapter table-of-contents for a manga id ordered by latest chapter first.",
    responses: {
      200: {
        description: "Aggregate manga chapter list",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(mangaChapterAggregateListSchema)),
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
    const item = await chapterService.listAggregatePublicChaptersByMangaId(id);

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

chapterRouteV2.get(
  "/chapters/:id",
  describeRoute({
    tags: ["Chapters"],
    summary: "Get chapter reader payload (v2)",
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
      403: {
        description: "Chapter requires password or is locked",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
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
    const { id } = c.req.valid("param");
    const result = await chapterService.getPublicChapterReaderById(id);

    if (result.kind === "not_found") {
      throw new AppError({
        code: "CHAPTER_NOT_FOUND",
        message: "Chapter not found",
        status: 404,
      });
    }

    if (result.kind === "forbidden") {
      throw new AppError({
        code: result.reason === "password_required" ? "PASSWORD_REQUIRED" : "CHAPTER_LOCKED",
        message: result.reason === "password_required" ? "Password required to access this chapter" : "Chapter is locked",
        status: 403,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.mangaChapters);

    return jsonSuccess(c, result.data);
  },
);
