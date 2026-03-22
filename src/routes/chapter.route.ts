import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";

import { chapterReaderParamsSchema, chapterReaderSchema } from "../contracts/chapter.js";
import { errorEnvelopeSchema, successEnvelopeSchema } from "../contracts/common.js";
import { AppError } from "../lib/errors.js";
import { CACHE_CONTROL } from "../lib/cache.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";
import { validationHook } from "../lib/validation.js";
import { chapterService } from "../services/chapter.service.js";

export const chapterRoute = new Hono<AppBindings>();

chapterRoute.get(
  "/chapters/:id",
  describeRoute({
    tags: ["Chapters"],
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
