# Moetruyen Public API

Public read-only REST API for [MoeTruyen](https://github.com/dex593/web1).

Full featured available soon...

Try it: [moe.suicaodex.com](https://moe.suicaodex.com/docs#tag/system)

## Core Endpoints

Detailed API reference is available at `/docs` (Scalar) or `/openapi.json`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Service health check |
| `GET` | `/v1/manga` | Paginated manga list |
| `GET` | `/v1/manga/:id` | Manga detail |
| `GET` | `/v1/manga/:id/chapters` | Chapter list for a manga |
| `GET` | `/v1/chapters/:id` | Reader payload (page URLs) |
| `GET` | `/v1/genres` | Public genre list |
| `GET` | `/v1/search/manga` | Manga search |

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
