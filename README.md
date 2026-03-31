# Moetruyen Public API

Public read-only REST API for [MoeTruyen](https://github.com/dex593/web1).

Docs: [moe.suicaodex.com](https://moe.suicaodex.com/docs#description/introduction)

## Quick Start

### Install
```bash
bun install
cp .env.example .env
```

### Run Local
```bash
bun run dev
```

Server starts at `http://localhost:8787`.

### Verify
```bash
bun run check
bun run test
bun run build
```

## Environment

### Required
- `DATABASE_URL`
- `API_BASE_URL`
- `ALLOWED_ORIGINS`
- `COVER_BASE_URL`
- `CHAPTER_CDN_BASE_URL`

### Optional
- `RATE_LIMIT_ENABLED`
- `APITALLY_CLIENT_ID`
- `LOG_LEVEL`
- `DATABASE_POOL_MAX`

### Operational Notes

- CORS uses exact origins from `ALLOWED_ORIGINS`.
- Global rate limiting is enabled by configuration.
- This repo does not own primary database migrations.
- Use `bun run db:pull` to refresh Drizzle schema from the database.
