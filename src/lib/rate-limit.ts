import type { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";

import { env } from "../config/env.js";
import { jsonError } from "./response.js";
import type { AppBindings } from "./request-id.js";

const getClientKey = (c: Context<AppBindings>): string => {
  const authorization = c.req.header("authorization");

  if (authorization) {
    return `auth:${authorization}`;
  }

  const forwardedFor = c.req.header("x-forwarded-for");

  if (forwardedFor) {
    return `ip:${forwardedFor.split(",")[0]?.trim() ?? "unknown"}`;
  }

  const realIp = c.req.header("x-real-ip") ?? c.req.header("cf-connecting-ip");

  return `ip:${realIp ?? "anonymous"}`;
};

const createRateLimitHandler = (retryAfterMs: number) =>
  (c: Context<AppBindings>) =>
    jsonError(
      c,
      {
        code: "RATE_LIMITED",
        message: "Too many requests, please try again later.",
        details: {
          retryAfterMs,
        },
      },
      429,
    );

export const globalRateLimitMiddleware =
  env.NODE_ENV === "test" || !env.RATE_LIMIT_ENABLED
    ? null
    : rateLimiter<AppBindings>({
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        limit: env.RATE_LIMIT_MAX,
        keyGenerator: getClientKey,
        statusCode: 429,
        standardHeaders: "draft-6",
        skipFailedRequests: true,
        skip: (c) => c.req.method === "OPTIONS" || c.req.path === "/health" || c.req.path === "/openapi.json" || c.req.path === "/docs",
        handler: createRateLimitHandler(env.RATE_LIMIT_WINDOW_MS),
      });
