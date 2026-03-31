# Moetruyen Public API

Public read-only REST API for [MoeTruyen](https://github.com/dex593/web1).

Docs: [moe.suicaodex.com](https://moe.suicaodex.com/docs#description/introduction)

This README is written as a changelog-style snapshot of the API surface.

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

## Changelog

### Current Snapshot

#### Added
- `GET /v1/manga/top`
- `GET /v1/teams`
- `GET /v1/comments/recent`
- `GET /v1/comments/manga/:id`
- `GET /v1/comments/chapters/:id`
- `GET /v2/manga`
- `GET /v2/manga/:id`
- `GET /v2/manga/:id/chapters`
- `GET /v2/manga/top`
- `GET /v2/manga/random`
- `GET /v2/chapters/:id`
- `GET /v2/comments/recent`
- `GET /v2/comments/manga/:id`
- `GET /v2/comments/chapters/:id`
- `GET /v2/genres`
- `GET /v2/teams`
- `GET /v2/teams/:id`
- `GET /v2/teams/:id/members`
- `GET /v2/teams/:id/updates`
- `GET /v2/search/manga`
- `GET /v2/teams/:id/manga`
- `GET /v2/users/:username`
- `GET /v2/users/:username/comments`

#### Changed
- Manga payloads now expose:
  - `groupName`
  - `createdAt`
  - `updatedAt`
  - `commentCount`
- Manga detail (`GET /v1/manga/:id`) now also exposes:
  - `totalViews`
  - `bookmarkCount`
- Manga list filtering now supports:
  - `hasChapters=0|1`
- Chapter list payloads now expose:
  - `groupName`
  - `viewCount`
- Chapter reader image URLs now include cache-busting `?t=` values based on chapter page update timestamps.

#### Stable Runtime Behavior
- Read-only database access only.
- Standard JSON envelope:
  - `success`
  - `data`
  - `meta`
- `meta` includes `requestId`.
- Structured API error codes such as:
  - `VALIDATION_ERROR`
  - `PASSWORD_REQUIRED`
  - `CHAPTER_LOCKED`

### Chapter Access Semantics

- `GET /v1/manga/:id/chapters` keeps protected chapters visible in the list.
- Each chapter item exposes:
  - `access: public | password_required | locked`
- `GET /v1/chapters/:id` returns:
  - `404 CHAPTER_NOT_FOUND`
  - `403 PASSWORD_REQUIRED`
  - `403 CHAPTER_LOCKED`
- `GET /v1/comments/chapters/:id` follows the same access rules.

### V1 Route Inventory

#### Manga
- `GET /v1/manga`
- `GET /v1/manga/:id`
- `GET /v1/manga/:id/chapters`
- `GET /v1/manga/top`
- `GET /v1/manga/random`

#### Chapters
- `GET /v1/chapters/:id`

#### Comments
- `GET /v1/comments/recent`
- `GET /v1/comments/manga/:id`
- `GET /v1/comments/chapters/:id`

#### Search / Genres
- `GET /v1/search/manga`
- `GET /v1/genres`

#### Teams / Users
- `GET /v1/teams`
- `GET /v1/teams/:id`
- `GET /v1/teams/:id/members`
- `GET /v1/teams/:id/manga`
- `GET /v1/teams/:id/updates`
- `GET /v1/users/:username`
- `GET /v1/users/:username/comments`

### V2 Manga Contract

#### Base Shape
All v2 manga-family routes share the same base manga object:
- `id`
- `slug`
- `title`
- `description`
- `author`
- `status`
- `cover`
- `coverUrl`
- `coverUpdatedAt`
- `groupName`
- `createdAt`
- `updatedAt`
- `isOneshot`
- `chapterCount`
- `latestChapterNumber`
- `latestChapterNumberText`

#### Include Expansions
Supported values:
- `include=stats`
- `include=genres`
- `include=stats,genres`

`include=stats` adds:
- `commentCount`
- `totalViews`
- `bookmarkCount`

`include=genres` adds:
- `genres`

#### Ranking Metadata
`GET /v2/manga/top` also returns:
- `ranking.rank`
- `ranking.sortBy`
- `ranking.time`
- `ranking.value`

#### Genre Filters
For `/v2/manga` and `/v2/teams/:id/manga`:
- `genre=13,15`
  - OR semantics
  - manga must match at least one listed genre id
- `genrex=18,21`
  - exclusion semantics
  - manga is removed if it has any listed genre id

### Operational Notes

- CORS uses exact origins from `ALLOWED_ORIGINS`.
- Global rate limiting is enabled by configuration.
- This repo does not own primary database migrations.
- Use `bun run db:pull` to refresh Drizzle schema from the database.
