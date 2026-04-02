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

const { app } = await import("../src/app.js");
const { CACHE_CONTROL } = await import("../src/lib/cache.js");
const { mangaV2Service } = await import("../src/services/manga-v2.service.js");

const originals = {
  listPublicManga: mangaV2Service.listPublicManga,
  getPublicMangaById: mangaV2Service.getPublicMangaById,
  listTopPublicManga: mangaV2Service.listTopPublicManga,
  listRandomPublicManga: mangaV2Service.listRandomPublicManga,
  searchPublicManga: mangaV2Service.searchPublicManga,
  listPublicTeamMangaByTeamId: mangaV2Service.listPublicTeamMangaByTeamId,
};

afterEach(() => {
  mangaV2Service.listPublicManga = originals.listPublicManga;
  mangaV2Service.getPublicMangaById = originals.getPublicMangaById;
  mangaV2Service.listTopPublicManga = originals.listTopPublicManga;
  mangaV2Service.listRandomPublicManga = originals.listRandomPublicManga;
  mangaV2Service.searchPublicManga = originals.searchPublicManga;
  mangaV2Service.listPublicTeamMangaByTeamId = originals.listPublicTeamMangaByTeamId;
});

const baseItem = {
  id: 1,
  slug: "sample-manga",
  title: "Sample Manga",
  description: "Sample description",
  author: "Author",
  status: "ongoing" as const,
  cover: "/uploads/covers/sample-manga.webp",
  coverUrl: "https://moetruyen.net/uploads/covers/sample-manga.webp?t=123",
  coverUpdatedAt: "2026-03-22T10:47:03.891Z",
  groupName: "Test Team",
  createdAt: "2026-03-20T10:47:03.891Z",
  updatedAt: "2026-03-22T10:47:03.891Z",
  isOneshot: false,
  chapterCount: 12,
  latestChapterNumber: 12,
  latestChapterNumberText: "12.000",
};

describe("public api manga v2 routes", () => {
  it("returns v2 manga list base payload without stats by default", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    mangaV2Service.listPublicManga = async (query) => {
      receivedQuery = query as Record<string, unknown>;
      return { items: [baseItem], total: 1 };
    };

    const response = await app.request("http://local/v2/manga?genre=13,15");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.mangaList);
    expect(receivedQuery).toMatchObject({ genre: [13, 15] });
    expect(body.data[0]).toMatchObject({
      slug: "sample-manga",
      groupName: "Test Team",
      chapterCount: 12,
    });
    expect(body.data[0].stats).toBeUndefined();
  });

  it("returns v2 manga list with stats include", async () => {
    mangaV2Service.listPublicManga = async () => ({
      items: [
        {
          ...baseItem,
          stats: {
            commentCount: 14,
            totalViews: 12345,
            bookmarkCount: 67,
          },
        },
      ],
      total: 1,
    });

    const response = await app.request("http://local/v2/manga?include=stats");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].stats).toEqual({
      commentCount: 14,
      totalViews: 12345,
      bookmarkCount: 67,
    });
    expect(body.data[0].genres).toBeUndefined();
  });

  it("returns v2 manga list with genres include", async () => {
    mangaV2Service.listPublicManga = async () => ({
      items: [
        {
          ...baseItem,
          genres: [
            { id: 1, name: "Action" },
            { id: 2, name: "Drama" },
          ],
        },
      ],
      total: 1,
    });

    const response = await app.request("http://local/v2/manga?include=genres");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].genres).toEqual([
      { id: 1, name: "Action" },
      { id: 2, name: "Drama" },
    ]);
    expect(body.data[0].stats).toBeUndefined();
  });

  it("returns v2 manga detail with optional stats", async () => {
    mangaV2Service.getPublicMangaById = async () => ({
      ...baseItem,
      stats: {
        commentCount: 14,
        totalViews: 12345,
        bookmarkCount: 67,
      },
    });

    const response = await app.request("http://local/v2/manga/1?include=stats");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      slug: "sample-manga",
      stats: {
        totalViews: 12345,
        bookmarkCount: 67,
      },
    });
  });

  it("returns v2 manga detail with optional genres", async () => {
    mangaV2Service.getPublicMangaById = async () => ({
      ...baseItem,
      genres: [{ id: 10, name: "Drama" }],
    });

    const response = await app.request("http://local/v2/manga/1?include=genres");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.genres).toEqual([{ id: 10, name: "Drama" }]);
    expect(body.data.stats).toBeUndefined();
  });

  it("returns v2 top manga with ranking metadata", async () => {
    mangaV2Service.listTopPublicManga = async () => ({
      items: [
        {
          ...baseItem,
          ranking: {
            rank: 1,
            sortBy: "views",
            time: "24h",
            value: 987,
          },
        },
      ],
      total: 1,
    });

    const response = await app.request("http://local/v2/manga/top");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].ranking).toEqual({
      rank: 1,
      sortBy: "views",
      time: "24h",
      value: 987,
    });
  });

  it("accepts bookmark ranking for all_time top manga", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    mangaV2Service.listTopPublicManga = async (query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            ...baseItem,
            ranking: {
              rank: 1,
              sortBy: "bookmarks",
              time: "all_time",
              value: 321,
            },
          },
        ],
        total: 1,
      };
    };

    const response = await app.request("http://local/v2/manga/top?sort_by=bookmarks&time=all_time");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(receivedQuery).toMatchObject({
      sort_by: "bookmarks",
      time: "all_time",
    });
    expect(body.data[0].ranking).toEqual({
      rank: 1,
      sortBy: "bookmarks",
      time: "all_time",
      value: 321,
    });
  });

  it("accepts bookmark ranking without an explicit time", async () => {
    mangaV2Service.listTopPublicManga = async () => ({
      items: [
        {
          ...baseItem,
          ranking: {
            rank: 1,
            sortBy: "bookmarks",
            time: "all_time",
            value: 321,
          },
        },
      ],
      total: 1,
    });

    const response = await app.request("http://local/v2/manga/top?sort_by=bookmarks");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].ranking).toEqual({
      rank: 1,
      sortBy: "bookmarks",
      time: "all_time",
      value: 321,
    });
  });

  it("accepts comments ranking for all_time top manga", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    mangaV2Service.listTopPublicManga = async (query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            ...baseItem,
            ranking: {
              rank: 1,
              sortBy: "comments",
              time: "all_time",
              value: 222,
            },
          },
        ],
        total: 1,
      };
    };

    const response = await app.request("http://local/v2/manga/top?sort_by=comments&time=all_time");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(receivedQuery).toMatchObject({
      sort_by: "comments",
      time: "all_time",
    });
    expect(body.data[0].ranking).toEqual({
      rank: 1,
      sortBy: "comments",
      time: "all_time",
      value: 222,
    });
  });

  it("accepts comments ranking without an explicit time", async () => {
    mangaV2Service.listTopPublicManga = async () => ({
      items: [
        {
          ...baseItem,
          ranking: {
            rank: 1,
            sortBy: "comments",
            time: "all_time",
            value: 222,
          },
        },
      ],
      total: 1,
    });

    const response = await app.request("http://local/v2/manga/top?sort_by=comments");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data[0].ranking).toEqual({
      rank: 1,
      sortBy: "comments",
      time: "all_time",
      value: 222,
    });
  });

  it("returns v2 search manga using the shared base shape", async () => {
    mangaV2Service.searchPublicManga = async () => [baseItem];

    const response = await app.request("http://local/v2/search/manga?q=sample");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.search);
    expect(body.data[0]).toMatchObject({
      slug: "sample-manga",
      latestChapterNumberText: "12.000",
    });
  });

  it("returns v2 team manga with include-based stats", async () => {
    mangaV2Service.listPublicTeamMangaByTeamId = async () => ({
      items: [
        {
          ...baseItem,
          stats: {
            commentCount: 4,
            totalViews: 100,
            bookmarkCount: 9,
          },
        },
      ],
      total: 1,
    });

    const response = await app.request("http://local/v2/teams/16/manga?include=stats");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.teamMangaList);
    expect(body.data[0].stats).toMatchObject({ totalViews: 100, bookmarkCount: 9 });
  });

  it("validates unsupported include values", async () => {
    const response = await app.request("http://local/v2/manga?include=authors");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects bookmark ranking for non-all_time windows", async () => {
    const response = await app.request("http://local/v2/manga/top?sort_by=bookmarks&time=7d");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects comments ranking for non-all_time windows", async () => {
    const response = await app.request("http://local/v2/manga/top?sort_by=comments&time=7d");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("validates v2 genre as numeric id", async () => {
    const response = await app.request("http://local/v2/manga?genre=comedy,15");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("passes multi-genre ids to v2 team manga queries", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    mangaV2Service.listPublicTeamMangaByTeamId = async (_id, query) => {
      receivedQuery = query as Record<string, unknown>;
      return { items: [baseItem], total: 1 };
    };

    const response = await app.request("http://local/v2/teams/16/manga?genre=13,15");

    expect(response.status).toBe(200);
    expect(receivedQuery).toMatchObject({ genre: [13, 15] });
  });

  it("passes genre exclusion ids to v2 manga queries", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    mangaV2Service.listPublicManga = async (query) => {
      receivedQuery = query as Record<string, unknown>;
      return { items: [baseItem], total: 1 };
    };

    const response = await app.request("http://local/v2/manga?genrex=18,21");

    expect(response.status).toBe(200);
    expect(receivedQuery).toMatchObject({ genrex: [18, 21] });
  });

  it("passes genre exclusion ids to v2 team manga queries", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    mangaV2Service.listPublicTeamMangaByTeamId = async (_id, query) => {
      receivedQuery = query as Record<string, unknown>;
      return { items: [baseItem], total: 1 };
    };

    const response = await app.request("http://local/v2/teams/16/manga?genrex=18,21");

    expect(response.status).toBe(200);
    expect(receivedQuery).toMatchObject({ genrex: [18, 21] });
  });
});
