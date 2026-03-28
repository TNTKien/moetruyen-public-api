# Moetruyen Public API

Public read-only REST API for [MoeTruyen](https://github.com/dex593/web1).

Try it: [moe.suicaodex.com](https://moe.suicaodex.com/docs#tag/system)

## Public Surface

Detailed API reference is available at `/docs` (Scalar) or `/openapi.json`.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Service health check |
| `GET` | `/` | Redirect to `/docs` |
| `GET` | `/docs` | Scalar API docs |
| `GET` | `/openapi.json` | OpenAPI document |
| `GET` | `/v1/manga` | Paginated manga list |
| `GET` | `/v1/manga/top` | Paginated top manga ranking |
| `GET` | `/v1/manga/:id` | Manga detail |
| `GET` | `/v1/manga/:id/chapters` | Chapter list for a manga |
| `GET` | `/v1/chapters/:id` | Reader payload (page URLs) |
| `GET` | `/v1/comments/recent` | Paginated recent public comments |
| `GET` | `/v1/comments/manga/:id` | Paginated manga-level public comment threads |
| `GET` | `/v1/comments/chapters/:id` | Paginated chapter public comment threads |
| `GET` | `/v1/genres` | Public genre list |
| `GET` | `/v1/search/manga` | Manga search |
| `GET` | `/v1/teams` | Paginated public team list |
| `GET` | `/v1/teams/:id` | Public team detail |
| `GET` | `/v1/teams/:id/members` | Approved public-facing team members |
| `GET` | `/v1/teams/:id/manga` | Paginated manga associated with a team |
| `GET` | `/v1/teams/:id/updates` | Paginated recent chapter updates for a team |
| `GET` | `/v1/users/:username` | Public user profile summary |
| `GET` | `/v1/users/:username/comments` | Paginated public-visible user comments and forum replies |

## Notes

- Manga and chapter detail routes use numeric `id`, not `slug`.
- The API is read-only and only returns public-safe fields.
- Manga payloads expose the existing English public status enum (`ongoing`, `completed`, `hiatus`, `cancelled`, `unknown`) while mapping Vietnamese DB values internally, plus `createdAt`, `updatedAt`, and `commentCount`.
- Manga list-style payloads now also include `groupName` when available.
- Chapter list payloads now include `groupName` and `viewCount` when available.
- `GET /v1/manga/top` currently supports `sort_by=views` with `time=24h|7d|30d|all_time`.
- `GET /v1/manga` supports enum-style `hasChapters=0|1`; default `0` returns manga that have chapters, while `1` returns manga without chapters.
- Comment list routes currently support `sort=created_at` with `order=asc|desc`.
- `GET /v1/teams` currently supports `q` plus `sort=updated_at|member_count|manga_count|chapter_count|comment_count`.
- `GET /v1/manga/:id/chapters` includes protected chapters and marks each item with `access: public | password_required | locked`.
- `GET /v1/chapters/:id` returns `403 PASSWORD_REQUIRED` for password-protected chapters and `403 CHAPTER_LOCKED` for locked oneshot chapters.
- `GET /v1/comments/chapters/:id` follows the same `403 PASSWORD_REQUIRED` and `403 CHAPTER_LOCKED` access semantics as the chapter reader route.
- `GET /v1/teams/:id/updates` preserves the same public chapter access semantics in its response payload.

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
