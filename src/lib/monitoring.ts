import type { Hono as BaseHono } from "hono";

import { env } from "../config/env.js";
import type { AppBindings } from "./request-id.js";

export const setupMonitoring = async (app: BaseHono<AppBindings>) => {
  if (!env.APITALLY_CLIENT_ID || env.NODE_ENV === "test") {
    return;
  }

  const { useApitally } = await import("apitally/hono");

  useApitally(app as unknown as BaseHono, {
    clientId: env.APITALLY_CLIENT_ID,
    env: env.APITALLY_ENV,
    requestLogging: {
      enabled: env.APITALLY_REQUEST_LOGGING_ENABLED,
    },
  });
};
