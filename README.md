# Moetruyen Public API

Repo scaffold cho public read-only REST API tách riêng khỏi monorepo.

## Mục tiêu hiện tại

- Dùng `Bun` cho package management.
- Dùng `TypeScript` + `Hono` trên Node.js.
- Chuẩn bị sẵn cấu trúc cho `Hono OpenAPI`, `Scalar`, `Drizzle`, và `Zod`.
- Chỉ phục vụ dữ liệu public bằng `GET` endpoints.
- Không sở hữu migration của database chính.

## Trạng thái scaffold

- Đã tạo cấu trúc thư mục theo plan.
- Đã có bootstrap Hono Node.js, route `GET /health`, `GET /openapi.json`, và `GET /docs`.
- Đã có config nền cho env, DB client, contracts, helpers, repository, service, route modules.
- Route business V1 mới dừng ở mức khung; cần kéo schema thật bằng `drizzle-kit pull` trước khi triển khai query.

## Cấu trúc

```text
moetruyen-public-api/
  src/
    config/
    contracts/
    db/
    lib/
    openapi/
    repositories/
    routes/
    services/
```

## Bắt đầu

```bash
bun install
cp .env.example .env
bun run dev
```

## Việc cần làm tiếp theo

1. Chạy `bun run db:pull` bằng read-only credential để sync schema thực.
2. Cài endpoint `GET /v1/search/manga`, `GET /v1/genres`, `GET /v1/manga`, `GET /v1/manga/:slug`, `GET /v1/manga/:slug/chapters`.
3. Thay các placeholder repository/service bằng query Drizzle read-only thật.
