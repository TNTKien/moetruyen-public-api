# Moetruyen Public API

Public read-only REST API for MoeTruyen, extracted into a standalone repository.

## Current scope

- Bun-managed TypeScript service using `Hono` on Node.js.
- Read-only public data only.
- OpenAPI JSON at `GET /openapi.json` and Scalar docs at `GET /docs`.
- Drizzle ORM wired to the existing PostgreSQL database with read-only queries.
- Public route smoke tests added with `bun test`.

## Implemented endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check |
| `GET` | `/openapi.json` | OpenAPI document |
| `GET` | `/docs` | Scalar API reference |
| `GET` | `/v1/genres` | List public genres with visible manga counts |
| `GET` | `/v1/manga` | Paginated public manga list |
| `GET` | `/v1/manga/:id` | Public manga detail |
| `GET` | `/v1/manga/:id/chapters` | Public chapter metadata for a manga |
| `GET` | `/v1/chapters/:id` | Public reader payload with chapter page URLs |
| `GET` | `/v1/search/manga` | Lightweight public manga search |

## Query parameters

### `GET /v1/manga`

- `page`: default `1`
- `limit`: default `20`, max `100`
- `q`: optional text search
- `genre`: optional genre name filter
- `status`: `ongoing | completed | hiatus | cancelled | unknown`
- `sort`: `updated_at | title | popular`, default `updated_at`

### `GET /v1/search/manga`

- `q`: required search text
- `limit`: default `10`, max `20`

### `GET /v1/manga/:id`

- `id`: numeric manga id

### `GET /v1/manga/:id/chapters`

- `id`: numeric manga id

### `GET /v1/chapters/:id`

- `id`: numeric chapter id
- Response includes `manga`, `chapter`, `pageUrls`, `prevChapter`, and `nextChapter`

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `API_BASE_URL` | yes | Public API base URL used in OpenAPI docs |
| `PUBLIC_SITE_URL` | yes | Main site URL for cross-linking or future outward references |
| `COVER_BASE_URL` | yes | Base URL used to build manga cover URLs |
| `CHAPTER_CDN_BASE_URL` | yes | Base URL for chapter/page assets |
| `ALLOWED_ORIGINS` | yes | Allowed origin list for browser clients |
| `DATABASE_POOL_MAX` | no | Maximum PostgreSQL pool size |
| `DATABASE_IDLE_TIMEOUT_MS` | no | Pool idle timeout |
| `DATABASE_CONNECTION_TIMEOUT_MS` | no | PostgreSQL connect timeout |
| `DATABASE_STATEMENT_TIMEOUT_MS` | no | Statement timeout |
| `DATABASE_QUERY_TIMEOUT_MS` | no | Query timeout |
| `LOG_LEVEL` | no | Runtime log level |

Important:

- `PUBLIC_SITE_URL` is not used for cover asset URLs.
- `COVER_BASE_URL` should point at `https://moetruyen.net`.
- `CHAPTER_CDN_BASE_URL` should point at `https://i.moetruyen.net`.

## Local development

```bash
bun install
cp .env.example .env
bun run dev
```

Default local URLs:

- API: `http://localhost:8787`
- OpenAPI: `http://localhost:8787/openapi.json`
- Docs: `http://localhost:8787/docs`

## Verification commands

```bash
bun run test
bun run check
bun run build
```

`bun run test` uses route-level mocks, so it does not require a live database connection.

GitHub Actions CI runs the same verification steps automatically on `push`, `pull_request`, and manual `workflow_dispatch`.

## Schema sync

This repo does not own the main database migrations. To refresh the introspected schema from the live database:

```bash
bun run db:pull
```

Generated Drizzle artifacts live under `drizzle/`, while the API consumes the curated public schema modules in `src/db/schema/`.

## Response envelope

Successful responses follow this shape:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-03-22T10:47:03.891Z",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 114,
      "totalPages": 6
    }
  }
}
```

Validation and application errors follow this shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters"
  },
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-03-22T10:47:03.891Z"
  }
}
```

## Test coverage today

- Health route response
- OpenAPI document response
- Scalar docs response
- Manga list success path
- Manga detail not-found path
- Manga chapters success path
- Manga chapter reader success and not-found paths
- Genre list success path
- Search validation and success paths
- Public helper behavior for search normalization and asset URL building

## Next likely work

1. Tighten production hardening for CORS, rate limiting, and request logging.
2. Add more data edge-case coverage for password-protected or locked chapters.
