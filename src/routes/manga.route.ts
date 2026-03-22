import { Hono } from "hono";

import type { AppBindings } from "../lib/request-id.js";

export const mangaRoute = new Hono<AppBindings>();
