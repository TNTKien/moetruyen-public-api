import { afterEach, describe, expect, it } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.PORT ??= "8787";
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/test";
process.env.API_BASE_URL ??= "http://localhost:8787";
process.env.PUBLIC_SITE_URL ??= "https://example.com";
process.env.COVER_BASE_URL ??= "https://moetruyen.net";
process.env.CHAPTER_CDN_BASE_URL ??= "https://i.moetruyen.net";
process.env.ALLOWED_ORIGINS ??= "https://example.com";
process.env.LOG_LEVEL ??= "info";

const { app } = await import("../src/app.ts");
const { CACHE_CONTROL } = await import("../src/lib/cache.ts");
const { mangaService } = await import("../src/services/manga.service.ts");
const { chapterService } = await import("../src/services/chapter.service.ts");
const { genreService } = await import("../src/services/genre.service.ts");
const { searchService } = await import("../src/services/search.service.ts");

const originals = {
  listPublicManga: mangaService.listPublicManga,
  getPublicMangaById: mangaService.getPublicMangaById,
  listPublicChaptersByMangaId: chapterService.listPublicChaptersByMangaId,
  getPublicChapterReaderById: chapterService.getPublicChapterReaderById,
  listPublicGenres: genreService.listPublicGenres,
  searchPublicManga: searchService.searchPublicManga,
};

afterEach(() => {
  mangaService.listPublicManga = originals.listPublicManga;
  mangaService.getPublicMangaById = originals.getPublicMangaById;
  chapterService.listPublicChaptersByMangaId = originals.listPublicChaptersByMangaId;
  chapterService.getPublicChapterReaderById = originals.getPublicChapterReaderById;
  genreService.listPublicGenres = originals.listPublicGenres;
  searchService.searchPublicManga = originals.searchPublicManga;
});

describe("public api routes", () => {
  it("returns the health payload", async () => {
    const response = await app.request("http://local/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        status: "ok",
        service: "moetruyen-public-api",
      },
    });
  });

  it("returns the OpenAPI document", async () => {
    const response = await app.request("http://local/openapi.json");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      openapi: expect.any(String),
      info: {
        title: "Moetruyen Public API",
      },
    });
  });

  it("returns the Scalar docs html", async () => {
    const response = await app.request("http://local/docs");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Moetruyen Public API Docs");
  });

  it("returns paginated manga data", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    mangaService.listPublicManga = async (query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            id: 1,
            slug: "sample-manga",
            title: "Sample Manga",
            author: "Author",
            status: "ongoing",
            cover: "/uploads/covers/sample-manga.webp",
            coverUrl: "https://moetruyen.net/uploads/covers/sample-manga.webp?t=123",
            coverUpdatedAt: "2026-03-22T10:47:03.891Z",
            latestChapterNumber: 12,
            latestChapterNumberText: "12.000",
            chapterCount: 12,
            isOneshot: false,
            genres: [{ id: 10, name: "Drama" }],
          },
        ],
        total: 42,
      };
    };

    const response = await app.request("http://local/v1/manga?limit=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.mangaList);
    expect(receivedQuery).toMatchObject({
      page: 1,
      limit: 1,
      sort: "updated_at",
    });
    expect(body.meta.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 42,
      totalPages: 42,
    });
    expect(body.data[0]).toMatchObject({
      slug: "sample-manga",
      coverUrl: "https://moetruyen.net/uploads/covers/sample-manga.webp?t=123",
    });
  });

  it("returns 404 when manga detail is missing", async () => {
    mangaService.getPublicMangaById = async () => null;

    const response = await app.request("http://local/v1/manga/999999");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "MANGA_NOT_FOUND",
      message: "Manga not found",
    });
  });

  it("returns chapter payloads for a manga", async () => {
    chapterService.listPublicChaptersByMangaId = async () => ({
      manga: {
        id: 1,
        slug: "sample-manga",
        title: "Sample Manga",
      },
      chapters: [
        {
          id: 99,
          number: 3,
          numberText: "3.000",
          title: "Chapter 3",
          date: "2026-03-22T10:47:03.891Z",
          pages: 18,
        },
      ],
    });

    const response = await app.request("http://local/v1/manga/1/chapters");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.mangaChapters);
    expect(body.data.chapters[0]).toMatchObject({
      id: 99,
      number: 3,
      title: "Chapter 3",
    });
  });

  it("returns chapter reader payloads", async () => {
    chapterService.getPublicChapterReaderById = async () => ({
      manga: {
        id: 1,
        slug: "sample-manga",
        title: "Sample Manga",
      },
      chapter: {
        id: 99,
        number: 3,
        numberText: "3.000",
        title: "Chapter 3",
        date: "2026-03-22T10:47:03.891Z",
        pages: 2,
        groupName: "Test Group",
        isOneshot: false,
      },
      pageUrls: [
        "https://i.moetruyen.net/chapters/manga-1/ch-3/001_abcde.webp",
        "https://i.moetruyen.net/chapters/manga-1/ch-3/002_abcde.webp",
      ],
      prevChapter: {
        id: 98,
        number: 2,
        numberText: "2.000",
        title: "Chapter 2",
      },
      nextChapter: null,
    });

    const response = await app.request("http://local/v1/chapters/99");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.pageUrls).toHaveLength(2);
    expect(body.data.prevChapter).toMatchObject({ id: 98, number: 2 });
    expect(body.data.chapter).toMatchObject({ id: 99, groupName: "Test Group" });
  });

  it("returns 404 when chapter reader payload is missing", async () => {
    chapterService.getPublicChapterReaderById = async () => null;

    const response = await app.request("http://local/v1/chapters/99");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "CHAPTER_NOT_FOUND",
      message: "Chapter not found",
    });
  });

  it("returns public genres", async () => {
    genreService.listPublicGenres = async () => [
      { id: 1, name: "Drama", count: 10 },
      { id: 2, name: "Romance", count: 5 },
    ];

    const response = await app.request("http://local/v1/genres");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.genres);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toEqual({ id: 1, name: "Drama", count: 10 });
  });

  it("validates search query params", async () => {
    const response = await app.request("http://local/v1/search/manga?q=%20%20");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns search results", async () => {
    searchService.searchPublicManga = async () => [
      {
        id: 7,
        slug: "search-match",
        title: "Search Match",
        cover: "/uploads/covers/search-match.webp",
        coverUrl: "https://moetruyen.net/uploads/covers/search-match.webp?t=321",
        coverUpdatedAt: "2026-03-22T10:47:03.891Z",
        status: "completed",
      },
    ];

    const response = await app.request("http://local/v1/search/manga?q=match&limit=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.search);
    expect(body.data[0]).toMatchObject({
      slug: "search-match",
      status: "completed",
    });
  });
});
