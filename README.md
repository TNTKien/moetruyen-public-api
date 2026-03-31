# Moetruyen Public API

Public read-only REST API for [MoeTruyen](https://github.com/dex593/web1).

Docs: [moe.suicaodex.com](https://moe.suicaodex.com/docs#description/introduction)

## Setup & Development

### 1. Install & Configure
```bash
bun install
cp .env.example .env
```

### 2. Run Local
```bash
bun run dev
```
Server starts at `http://localhost:8787`.

### 3. Verify
```bash
bun run check  # Type check
bun run test   # Run route tests
bun run build  # Production build
```

## Environment Variables

### Core (Required)
- `DATABASE_URL`: PostgreSQL connection string.
- `API_BASE_URL`: Public API URL for OpenAPI docs.
- `ALLOWED_ORIGINS`: Comma-separated CORS origins.
- `COVER_BASE_URL`: Usually `https://moetruyen.net`.
- `CHAPTER_CDN_BASE_URL`: Usually `https://i.moetruyen.net`.

### Operational (Optional)
- `RATE_LIMIT_ENABLED`: Enable/disable global rate limiting.
- `APITALLY_CLIENT_ID`: Enable Apitally monitoring.
- `LOG_LEVEL`: Runtime log level.
- `DATABASE_POOL_MAX`: PostgreSQL pool size.

## Runtime Behavior

- **Security**: CORS enabled via `ALLOWED_ORIGINS`. Rate limiting defaults to ~7 req/s per IP.
- **Database**: Read-only queries via Drizzle. Use `bun run db:pull` to sync schema from DB.
- **Responses**: Standardized JSON envelope with `success`, `data`, and `meta` (includes `requestId`).
- **Errors**: Normalized error codes (e.g., `VALIDATION_ERROR`, `PASSWORD_REQUIRED`).

## Public Routes

### Manga V2

- `GET /v2/manga`
- `GET /v2/manga/:id`
- `GET /v2/manga/top`
- `GET /v2/manga/random`
- `GET /v2/search/manga`
- `GET /v2/teams/:id/manga`

The `/v2` manga-family routes standardize a shared manga base shape. Use `include=stats`, `include=genres`, or `include=stats,genres` to opt into:

- `commentCount`
- `totalViews`
- `bookmarkCount`

and/or the manga `genres` array.

For `/v2/manga` and `/v2/teams/:id/manga`, `genre` is a comma-separated list of numeric genre ids with OR semantics (for example `genre=13,15`), while `genrex` excludes manga that have any of the listed genre ids (for example `genrex=18,21`). This differs from the legacy v1 name-based filter.

Route-specific metadata stays separate. For example, `/v2/manga/top` returns `ranking` metadata in addition to the shared manga base object.
