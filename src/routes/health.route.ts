import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { z } from "zod";

import { successEnvelopeSchema } from "../contracts/common.js";
import type { AppBindings } from "../lib/request-id.js";
import { jsonSuccess } from "../lib/response.js";

const healthPayloadSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("moetruyen-public-api"),
});

export const healthRoute = new Hono<AppBindings>();

healthRoute.get(
  "/health",
  describeRoute({
    tags: ["System"],
    summary: "Health check",
    description: "Basic service health check for uptime probes and deployment verification.",
    responses: {
      200: {
        description: "Service is healthy",
        content: {
          "application/json": {
            schema: resolver(successEnvelopeSchema(healthPayloadSchema)),
          },
        },
      },
    },
  }),
  (c) =>
    jsonSuccess(c, {
      status: "ok",
      service: "moetruyen-public-api",
    }),
);
