import { apiReference } from "@scalar/hono-api-reference";
import type { Hono } from "hono";

import type { AppBindings } from "../lib/request-id.js";

export const mountScalarDocs = (app: Hono<AppBindings>) => {
  app.get(
    "/docs",
    apiReference({
      spec: {
        url: "/openapi.json",
      },
      theme: "default",
      pageTitle: "Moetruyen Public API Docs",
    }),
  );
};
