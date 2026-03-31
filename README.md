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
