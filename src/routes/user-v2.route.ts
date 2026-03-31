import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";

import { errorEnvelopeSchema, successEnvelopeSchema } from "../contracts/common.js";
import { userCommentItemSchema, userCommentsQuerySchema, userSummarySchema, userUsernameParamsSchema } from "../contracts/user.js";
import { CACHE_CONTROL } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";
import { getPaginationMeta } from "../lib/pagination.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";
import { validationHook } from "../lib/validation.js";
import { userService } from "../services/user.service.js";

export const userRouteV2 = new Hono<AppBindings>();

userRouteV2.get(
  "/users/:username/comments",
  describeRoute({
    tags: ["Users"],
    summary: "List public user comments (v2)",
    description: "Returns paginated public-visible manga comments and forum replies for a username.",
    responses: {
      200: {
        description: "User comments",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(z.array(userCommentItemSchema))),
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
        description: "User not found",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("param", userUsernameParamsSchema, validationHook),
  validator("query", userCommentsQuerySchema, validationHook),
  async (c) => {
    const { username } = c.req.valid("param");
    const query = c.req.valid("query");
    const result = await userService.listPublicUserCommentsByUsername(username, query);

    if (!result) {
      throw new AppError({
        code: "USER_NOT_FOUND",
        message: "User not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.userComments);

    return jsonSuccess(c, result.items, {
      pagination: getPaginationMeta({ page: query.page, limit: query.limit }, result.total),
    });
  },
);

userRouteV2.get(
  "/users/:username",
  describeRoute({
    tags: ["Users"],
    summary: "Get public user (v2)",
    description: "Returns a public-safe user profile summary for a username.",
    responses: {
      200: {
        description: "User detail",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(userSummarySchema)),
          },
        },
      },
      400: {
        description: "Invalid route parameters",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
      404: {
        description: "User not found",
        content: {
          "application/json": {
            schema: resolver(errorEnvelopeSchema),
          },
        },
      },
    },
  }),
  validator("param", userUsernameParamsSchema, validationHook),
  async (c) => {
    const { username } = c.req.valid("param");
    const item = await userService.getPublicUserByUsername(username);

    if (!item) {
      throw new AppError({
        code: "USER_NOT_FOUND",
        message: "User not found",
        status: 404,
      });
    }

    c.header("Cache-Control", CACHE_CONTROL.userDetail);

    return jsonSuccess(c, item);
  },
);
