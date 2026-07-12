import { afterEach, describe, expect, it } from "bun:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/test";
process.env.API_BASE_URL = "http://localhost:8787";
process.env.PUBLIC_SITE_URL = "https://example.com";
process.env.COVER_BASE_URL = "https://moetruyen.net";
process.env.CHAPTER_CDN_BASE_URL = "https://i.moetruyen.net";
process.env.ALLOWED_ORIGINS = "https://example.com";

const { pool } = await import("../src/db/client.js");
const { teamRepository } = await import("../src/repositories/team.repository.js");

const originalQuery = pool.query.bind(pool);

afterEach(() => {
  pool.query = originalQuery as typeof pool.query;
});

describe("team repository", () => {
  it("resolves groups only through manga_translation_teams links", async () => {
    let capturedSql = "";
    let capturedParams: unknown[] = [];

    pool.query = (async (sql: string, params: unknown[]) => {
      capturedSql = sql;
      capturedParams = params;
      return {
        rows: [{ manga_id: 1, team_id: 361, team_name: "An" }],
        rowCount: 1,
      };
    }) as typeof pool.query;

    const groups = await teamRepository.resolvePublicGroupsByMangaIds([1, 2, 2]);

    expect(groups.get(1)).toEqual([{ id: 361, name: "An" }]);
    expect(groups.get(2)).toEqual([]);
    expect(capturedParams).toEqual([[1, 2]]);
    expect(capturedSql).toContain("FROM manga_translation_teams mtt");
    expect(capturedSql).not.toContain("group_name");
    expect(capturedSql).not.toContain("LIKE");
  });
});
