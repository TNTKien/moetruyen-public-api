import { afterEach, describe, expect, it } from "bun:test";

process.env.NODE_ENV = "test";
process.env.PORT = "8787";
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/test";
process.env.API_BASE_URL = "http://localhost:8787";
process.env.PUBLIC_SITE_URL = "https://example.com";
process.env.COVER_BASE_URL = "https://moetruyen.net";
process.env.CHAPTER_CDN_BASE_URL = "https://i.moetruyen.net";
process.env.ALLOWED_ORIGINS = "https://example.com";
process.env.LOG_LEVEL = "info";

const { pool } = await import("../src/db/client.js");
const { commentRepository } = await import("../src/repositories/comment.repository.js");

const originalQuery = pool.query.bind(pool);

afterEach(() => {
  pool.query = originalQuery as typeof pool.query;
});

describe("comment repository", () => {
  it("calculates recent comment pages with a lateral scope count", async () => {
    const queries: string[] = [];

    pool.query = (async (sql: string) => {
      queries.push(sql);

      if (sql.includes("COUNT(*) AS total")) {
        return { rows: [{ total: 0 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }) as typeof pool.query;

    await commentRepository.listRecentPublicComments({
      page: 1,
      limit: 20,
      sort: "created_at",
      order: "desc",
    });

    const listSql = queries.find((sql) => sql.includes("m.slug AS manga_slug")) ?? "";

    expect(listSql).toContain("LEFT JOIN LATERAL");
    expect(listSql).toContain("AND c_scope.id > c.id");
    expect(listSql).not.toContain("COUNT(*) FILTER");
    expect(listSql).not.toContain("GROUP BY");
  });
});
