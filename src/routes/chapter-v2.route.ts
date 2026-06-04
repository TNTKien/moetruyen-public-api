import { Hono, type Context } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";

import { chapterListQuerySchema, chapterPageAccessBodySchema, chapterPageAccessSchema, chapterReaderParamsSchema, chapterReaderSchema, mangaChapterAggregateListSchema, mangaChapterListSchema } from "../contracts/chapter.js";
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

const getPageAccessSessionId = (c: Context<AppBindings>): string =>
  [
    c.req.header("Authorization"),
    c.req.header("CF-Connecting-IP"),
    c.req.header("X-Forwarded-For"),
    c.req.header("X-Real-IP"),
    c.req.header("User-Agent"),
    c.get("requestId"),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("|");

chapterRouteV2.post(
  "/chapters/:id/page-access",
  describeRoute({
    tags: ["Chapters"],
    summary: "Create IMGX page access grants",
    description: "Returns short-lived IMGX page download URLs and wrapped v2/v3 key grants for selected chapter pages.",
    responses: {
      200: {
        description: "IMGX page grants",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(chapterPageAccessSchema)),
          },
        },
      },
      400: {
        description: "Invalid page access request",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
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
        description: "IMGX chapter not found",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
      503: {
        description: "IMGX is not configured",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("param", chapterReaderParamsSchema, validationHook),
  validator("json", chapterPageAccessBodySchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const { pageIndexes } = c.req.valid("json");
    const result = await chapterService.getPublicChapterPageAccessById(id, pageIndexes, getPageAccessSessionId(c));

    if (result.kind === "not_found" || result.kind === "not_imgx") {
      throw new AppError({
        code: "IMGX_CHAPTER_NOT_FOUND",
        message: "Protected chapter not found",
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

    if (result.kind === "not_configured") {
      throw new AppError({
        code: "IMGX_NOT_CONFIGURED",
        message: "Protected reader is not configured",
        status: 503,
      });
    }

    if (result.kind === "invalid_request") {
      throw new AppError({
        code: result.reason === "too_many_pages_requested" ? "TOO_MANY_PAGES_REQUESTED" : "NO_PAGES_REQUESTED",
        message: result.reason === "too_many_pages_requested" ? "Too many pages requested" : "No pages requested",
        status: 400,
        ...(result.maxWindow ? { details: { maxWindow: result.maxWindow } } : {}),
      });
    }

    c.header("Cache-Control", "no-store");

    return jsonSuccess(c, result.data);
  },
);
