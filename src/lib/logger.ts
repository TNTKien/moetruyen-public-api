import type { MiddlewareHandler } from "hono";

import { env } from "../config/env.js";
import type { AppBindings } from "./request-id.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const canLog = (level: LogLevel): boolean => LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[env.LOG_LEVEL];

const writeLog = (level: LogLevel, event: string, payload: Record<string, unknown>) => {
  if (!canLog(level)) {
    return;
  }

  const entry = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.log(entry);
};

export const requestLoggerMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const startedAt = performance.now();
  const requestId = c.get("requestId");

  writeLog("info", "request_started", {
    requestId,
    method: c.req.method,
    path: c.req.path,
  });

  try {
    await next();

    writeLog("info", "request_completed", {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    writeLog("error", "request_failed", {
      requestId,
      method: c.req.method,
      path: c.req.path,
      durationMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
};

export const logger = {
  debug(event: string, payload: Record<string, unknown>) {
    writeLog("debug", event, payload);
  },
  info(event: string, payload: Record<string, unknown>) {
    writeLog("info", event, payload);
  },
  warn(event: string, payload: Record<string, unknown>) {
    writeLog("warn", event, payload);
  },
  error(event: string, payload: Record<string, unknown>) {
    writeLog("error", event, payload);
  },
};
