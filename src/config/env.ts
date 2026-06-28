import { z } from "zod";

import { parseHiddenMangaIds } from "../lib/hidden-manga.js";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(20),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DATABASE_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  API_BASE_URL: z.string().url().default("http://localhost:8787"),
  PUBLIC_SITE_URL: z.string().url().default("https://example.com"),
  CHAPTER_CDN_BASE_URL: z.string().url().default("https://i.moetruyen.net"),
  COVER_BASE_URL: z.string().url().default("https://moetruyen.net"),
  USER_AVATAR_BASE_URL: z.string().url().default("https://moetruyen.net"),
  TEAM_AVATAR_BASE_URL: z.string().url().default("https://moetruyen.net"),
  TEAM_COVER_BASE_URL: z.string().url().default("https://moetruyen.net"),
  ALLOWED_ORIGINS: z.string().default("https://example.com"),
  HIDDEN_MANGA_IDS: z
    .string()
    .default("")
    .transform((value, ctx) => {
      const parsed = parseHiddenMangaIds(value);

      if (parsed.ok) {
        return parsed.value;
      }

      ctx.addIssue({
        code: "custom",
        message: parsed.message,
      });

      return [];
    }),
  RATE_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(7),
  RATE_LIMIT_WHITELIST_UAS: z
    .string()
    .default("[]")
    .transform((value, ctx) => {
      try {
        const parsed = JSON.parse(value);

        if (
          !Array.isArray(parsed) ||
          !parsed.every((item) => typeof item === "string")
        ) {
          ctx.addIssue({
            code: "custom",
            message: "RATE_LIMIT_WHITELIST_UAS must be a JSON array of strings",
          });

          return [] as string[];
        }

        return parsed as string[];
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "RATE_LIMIT_WHITELIST_UAS must be valid JSON",
        });

        return [] as string[];
      }
    }),
  RATE_LIMIT_WHITELIST_LIMIT: z.coerce.number().int().min(0).default(0),
  IMGX_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  IMGX_SECRET: z.string().default(""),
  IMGX_SESSION_HMAC_SECRET: z.string().default(""),
  IMGX_PAGE_ACCESS_TTL_MS: z.coerce.number().int().positive().default(60_000),
  IMGX_PAGE_ACCESS_WINDOW_MAX: z.coerce.number().int().positive().default(5),
  APITALLY_CLIENT_ID: z.string().trim().min(1).optional(),
  APITALLY_ENV: z.string().trim().min(1).default("dev"),
  APITALLY_REQUEST_LOGGING_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid environment configuration: ${parsedEnv.error.message}`);
}

export const env = parsedEnv.data;

export const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
