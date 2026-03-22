import type { Context } from "hono";

import type { ErrorBody } from "../contracts/common.js";
import type { AppBindings } from "./request-id.js";

interface ResponseOptions {
  status?: ApiStatusCode;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type ApiStatusCode = 200 | 400 | 403 | 404 | 408 | 409 | 429 | 500 | 501 | 503;

const buildMeta = (c: Context<AppBindings>, pagination?: ResponseOptions["pagination"]) => ({
  requestId: c.get("requestId"),
  timestamp: new Date().toISOString(),
  ...(pagination ? { pagination } : {}),
});

export const jsonSuccess = <TData>(c: Context<AppBindings>, data: TData, options: ResponseOptions = {}) => {
  return c.json(
    {
      success: true as const,
      data,
      meta: buildMeta(c, options.pagination),
    },
    { status: options.status ?? 200 },
  );
};

export const jsonError = (c: Context<AppBindings>, error: ErrorBody, status: ApiStatusCode = 500) => {
  return c.json(
    {
      success: false as const,
      error,
      meta: buildMeta(c),
    },
    { status },
  );
};
