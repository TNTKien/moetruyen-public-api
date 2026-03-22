import { z } from "zod";

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
  ALLOWED_ORIGINS: z.string().default("https://example.com"),
  RATE_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  SEARCH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
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
