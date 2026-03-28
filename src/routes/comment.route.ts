import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { chapterReaderParamsSchema } from "../contracts/chapter.js";
import { commentListQuerySchema, commentMangaParamsSchema, commentThreadItemSchema, recentCommentItemSchema } from "../contracts/comment.js";
import { errorEnvelopeSchema, successEnvelopeSchema } from "../contracts/common.js";
import { CACHE_CONTROL } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";
import { getPaginationMeta } from "../lib/pagination.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";
import { validationHook } from "../lib/validation.js";
import { commentService } from "../services/comment.service.js";

export const commentRoute = new Hono<AppBindings>();

commentRoute.get(
  "/comments/recent",
  describeRoute({
    tags: ["Comments"],
    summary: "List recent public comments",
    description: "Returns paginated recent visible root comments across public manga and chapters.",
    responses: {
      200: {
        description: "Recent public comments",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(recentCommentItemSchema))),
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
  validator("query", commentListQuerySchema, validationHook),
  async (c) => {
    const query = c.req.valid("query");
    const result = await commentService.listRecentPublicComments(query);

    c.header("Cache-Control", CACHE_CONTROL.recentComments);

    return jsonSuccess(c, result.items, {
      pagination: getPaginationMeta({ page: query.page, limit: query.limit }, result.total),
    });
  },
);

commentRoute.get(
  "/comments/manga/:id",
  describeRoute({
    tags: ["Comments"],
    summary: "List public manga comments",
    description: "Returns paginated visible manga-level comment threads for a manga id.",
    responses: {
      200: {
        description: "Manga comment threads",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(commentThreadItemSchema))),
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
  validator("param", commentMangaParamsSchema, validationHook),
  validator("query", commentListQuerySchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const result = await commentService.listPublicMangaCommentsByMangaId(id, query);

    if (!result) {
      throw new AppError({
        code: "MANGA_NOT_FOUND",
        message: "Manga not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.mangaComments);

    return jsonSuccess(c, result.items, {
      pagination: getPaginationMeta({ page: query.page, limit: query.limit }, result.total),
    });
  },
);

commentRoute.get(
  "/comments/chapters/:id",
  describeRoute({
    tags: ["Comments"],
    summary: "List public chapter comments",
    description: "Returns paginated visible comment threads for a public chapter id.",
    responses: {
      200: {
        description: "Chapter comment threads",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(commentThreadItemSchema))),
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
  validator("query", commentListQuerySchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const result = await commentService.listPublicChapterCommentsByChapterId(id, query);

    if ("kind" in result) {
      if (result.kind === "not_found") {
        throw new AppError({
          code: "CHAPTER_NOT_FOUND",
          message: "Chapter not found",
          status: 404,
        });
      }

      throw new AppError({
        code: result.reason === "password_required" ? "PASSWORD_REQUIRED" : "CHAPTER_LOCKED",
        message: result.reason === "password_required" ? "Password required to access this chapter" : "Chapter is locked",
        status: 403,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.chapterComments);

    return jsonSuccess(c, result.items, {
      pagination: getPaginationMeta({ page: query.page, limit: query.limit }, result.total),
    });
  },
);
