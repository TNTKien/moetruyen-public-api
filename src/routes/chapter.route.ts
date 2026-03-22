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
    const item = await chapterService.getPublicChapterReaderById(id);

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
