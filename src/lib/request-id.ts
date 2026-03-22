import { randomUUID } from "node:crypto";

import type { MiddlewareHandler } from "hono";

export interface AppBindings {
  Variables: {
    requestId: string;
  };
}

export const REQUEST_ID_HEADER = "x-request-id";

export const requestIdMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const requestId = c.req.header(REQUEST_ID_HEADER) ?? `req_${randomUUID().replace(/-/g, "")}`;

  c.set("requestId", requestId);

  await next();

  c.header(REQUEST_ID_HEADER, requestId);
};
