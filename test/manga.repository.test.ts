import { afterEach, describe, expect, it } from "bun:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/test";
process.env.API_BASE_URL = "http://localhost:8787";
process.env.PUBLIC_SITE_URL = "https://example.com";
process.env.COVER_BASE_URL = "https://moetruyen.net";
process.env.CHAPTER_CDN_BASE_URL = "https://i.moetruyen.net";
process.env.ALLOWED_ORIGINS = "https://example.com";

const { pool } = await import("../src/db/client.js");
const { mangaRepository } = await import("../src/repositories/manga.repository.js");

const originalQuery = pool.query.bind(pool);

afterEach(() => {
  pool.query = originalQuery as typeof pool.query;
});

describe("manga repository", () => {
  it("filters team manga by team id instead of group name", async () => {
    const queries: Array<{ text: string; values: unknown[] }> = [];

    pool.query = (async (query: string | { text?: string; values?: unknown[] }, values?: unknown[]) => {
      const text = typeof query === "string" ? query : query.text ?? "";
      const params = values ?? (typeof query === "string" ? [] : query.values ?? []);
      queries.push({ text, values: params });

      return {
        command: "SELECT",
        rowCount: text.includes("count(*)") ? 1 : 0,
        oid: 0,
        fields: [],
        rows: text.includes("count(*)") ? [{ total: 0 }] : [],
      };
    }) as typeof pool.query;

    await mangaRepository.listPublicMangaByTeamId(361, {
      page: 1,
      limit: 20,
      sort: "updated_at",
      hasChapters: 0,
    });

    const teamQueries = queries.filter((query) => query.text.includes('"manga_translation_teams"'));

    expect(teamQueries).toHaveLength(2);
    for (const query of teamQueries) {
      expect(query.text).toContain('"manga_translation_teams"');
      expect(query.text.toLowerCase()).not.toContain(" like ");
      expect(query.values).toContain(361);
    }
  });
});
