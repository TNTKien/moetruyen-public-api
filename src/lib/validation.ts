import type { Hook } from "@hono/standard-validator";

import type { AppBindings } from "./request-id.js";
import { jsonError } from "./response.js";

export const validationHook: Hook<unknown, AppBindings, string> = (result, c) => {
  if (result.success) {
    return;
  }

  return jsonError(
    c,
    {
      code: "VALIDATION_ERROR",
      message: "Invalid request parameters",
      details: {
        issues: result.error,
      },
    },
    400,
  );
};
