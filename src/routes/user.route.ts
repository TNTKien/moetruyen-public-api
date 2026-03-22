import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";

import { errorEnvelopeSchema, successEnvelopeSchema } from "../contracts/common.js";
import { userSummarySchema, userUsernameParamsSchema } from "../contracts/user.js";
import { CACHE_CONTROL } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";
import { validationHook } from "../lib/validation.js";
import { userService } from "../services/user.service.js";

export const userRoute = new Hono<AppBindings>();

userRoute.get(
  "/users/:username",
  describeRoute({
    tags: ["Users"],
    summary: "Get public user",
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
