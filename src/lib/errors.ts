import type { ApiStatusCode } from "./response.js";

export interface AppErrorOptions {
  code: string;
  message: string;
  status: ApiStatusCode;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: string;
  readonly status: ApiStatusCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;
