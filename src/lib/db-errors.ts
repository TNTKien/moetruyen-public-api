import { AppError } from "./errors.js";

const createAppError = (options: {
  code: string;
  message: string;
  status: 400 | 409 | 500 | 503;
  details?: Record<string, unknown>;
}) =>
  new AppError({
    code: options.code,
    message: options.message,
    status: options.status,
    ...(options.details ? { details: options.details } : {}),
  });

const getNestedCause = (error: unknown): unknown => {
  if (!error || typeof error !== "object" || !("cause" in error)) {
    return error;
  }

  return (error as { cause?: unknown }).cause ?? error;
};

const getErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === "string" ? code : undefined;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const getErrorDetails = (error: unknown): Record<string, unknown> | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const details = error as {
    detail?: unknown;
    constraint?: unknown;
    table?: unknown;
    column?: unknown;
    schema?: unknown;
  };

  return {
    ...(typeof details.detail === "string" ? { detail: details.detail } : {}),
    ...(typeof details.constraint === "string" ? { constraint: details.constraint } : {}),
    ...(typeof details.table === "string" ? { table: details.table } : {}),
    ...(typeof details.column === "string" ? { column: details.column } : {}),
    ...(typeof details.schema === "string" ? { schema: details.schema } : {}),
  };
};

export const normalizeDbError = (error: unknown): AppError | null => {
  const candidate = getNestedCause(error);
  const code = getErrorCode(candidate) ?? getErrorCode(error);
  const message = getErrorMessage(candidate);
  const details = getErrorDetails(candidate);

  switch (code) {
    case "23505":
      return createAppError({
        code: "DB_CONFLICT",
        message: "Resource already exists",
        status: 409,
        ...(details ? { details } : {}),
      });
    case "23503":
      return createAppError({
        code: "DB_CONSTRAINT_ERROR",
        message: "Related resource constraint failed",
        status: 409,
        ...(details ? { details } : {}),
      });
    case "23502":
    case "22P02":
    case "23514":
      return createAppError({
        code: "DB_INVALID_INPUT",
        message: "Invalid database input",
        status: 400,
        ...(details ? { details } : {}),
      });
    case "57014":
      return createAppError({
        code: "DB_TIMEOUT",
        message: "Database query timed out",
        status: 503,
        ...(details ? { details } : {}),
      });
    case "53300":
    case "08001":
    case "08003":
    case "08006":
    case "57P03":
      return createAppError({
        code: "DB_UNAVAILABLE",
        message: "Database is unavailable",
        status: 503,
        ...(details ? { details } : {}),
      });
  }

  if (
    message.includes("ECONNREFUSED") ||
    message.includes("Connection terminated") ||
    message.includes("timeout") ||
    message.includes("terminat")
  ) {
    return createAppError({
      code: "DB_UNAVAILABLE",
      message: "Database is unavailable",
      status: 503,
      details: {
        ...(details ?? {}),
        reason: message,
      },
    });
  }

  if (code || message.toLowerCase().includes("database") || message.toLowerCase().includes("query")) {
    return createAppError({
      code: "DB_ERROR",
      message: "Database operation failed",
      status: 500,
      details: {
        ...(details ?? {}),
        ...(code ? { dbCode: code } : {}),
      },
    });
  }

  return null;
};
