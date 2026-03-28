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
const { mangaService } = await import("../src/services/manga.service.js");
const { chapterService } = await import("../src/services/chapter.service.js");
const { genreService } = await import("../src/services/genre.service.js");
const { searchService } = await import("../src/services/search.service.js");
const { teamService } = await import("../src/services/team.service.js");
const { userService } = await import("../src/services/user.service.js");
const { commentService } = await import("../src/services/comment.service.js");

const originals = {
  listPublicManga: mangaService.listPublicManga,
  listTopPublicManga: mangaService.listTopPublicManga,
  listRandomPublicManga: mangaService.listRandomPublicManga,
  getPublicMangaById: mangaService.getPublicMangaById,
  listPublicChaptersByMangaId: chapterService.listPublicChaptersByMangaId,
  getPublicChapterReaderById: chapterService.getPublicChapterReaderById,
  listPublicGenres: genreService.listPublicGenres,
  searchPublicManga: searchService.searchPublicManga,
  listPublicTeams: teamService.listPublicTeams,
  getPublicTeamById: teamService.getPublicTeamById,
  listPublicTeamUpdatesByTeamId: teamService.listPublicTeamUpdatesByTeamId,
  listPublicTeamMangaByTeamId: teamService.listPublicTeamMangaByTeamId,
  listPublicTeamMembersByTeamId: teamService.listPublicTeamMembersByTeamId,
  getPublicUserByUsername: userService.getPublicUserByUsername,
  listPublicUserCommentsByUsername: userService.listPublicUserCommentsByUsername,
  listRecentPublicComments: commentService.listRecentPublicComments,
  listPublicMangaCommentsByMangaId: commentService.listPublicMangaCommentsByMangaId,
  listPublicChapterCommentsByChapterId: commentService.listPublicChapterCommentsByChapterId,
};

afterEach(() => {
  mangaService.listPublicManga = originals.listPublicManga;
  mangaService.listTopPublicManga = originals.listTopPublicManga;
  mangaService.listRandomPublicManga = originals.listRandomPublicManga;
  mangaService.getPublicMangaById = originals.getPublicMangaById;
  chapterService.listPublicChaptersByMangaId = originals.listPublicChaptersByMangaId;
  chapterService.getPublicChapterReaderById = originals.getPublicChapterReaderById;
  genreService.listPublicGenres = originals.listPublicGenres;
  searchService.searchPublicManga = originals.searchPublicManga;
  teamService.listPublicTeams = originals.listPublicTeams;
  teamService.getPublicTeamById = originals.getPublicTeamById;
  teamService.listPublicTeamUpdatesByTeamId = originals.listPublicTeamUpdatesByTeamId;
  teamService.listPublicTeamMangaByTeamId = originals.listPublicTeamMangaByTeamId;
  teamService.listPublicTeamMembersByTeamId = originals.listPublicTeamMembersByTeamId;
  userService.getPublicUserByUsername = originals.getPublicUserByUsername;
  userService.listPublicUserCommentsByUsername = originals.listPublicUserCommentsByUsername;
  commentService.listRecentPublicComments = originals.listRecentPublicComments;
  commentService.listPublicMangaCommentsByMangaId = originals.listPublicMangaCommentsByMangaId;
  commentService.listPublicChapterCommentsByChapterId = originals.listPublicChapterCommentsByChapterId;
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

  it("redirects the root path to docs", async () => {
    const response = await app.request("http://local/", {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/docs");
  });

  it("serves the favicon asset", async () => {
    const response = await app.request("http://local/favicon.ico");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/x-icon");
  });

  it("applies CORS headers for allowed origins", async () => {
    const response = await app.request("http://local/health", {
      headers: {
        Origin: "https://example.com",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe("https://example.com");
    expect(response.headers.get("access-control-expose-headers")).toContain("X-Request-Id");
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
            description: "A sample description",
            author: "Author",
            status: "ongoing",
            cover: "/uploads/covers/sample-manga.webp",
            coverUrl: "https://moetruyen.net/uploads/covers/sample-manga.webp?t=123",
            coverUpdatedAt: "2026-03-22T10:47:03.891Z",
            groupName: "Test Team",
            updatedAt: "2026-03-22T10:47:03.891Z",
            createdAt: "2026-03-20T10:47:03.891Z",
            commentCount: 5,
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
      hasChapters: 0,
    });
    expect(body.meta.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 42,
      totalPages: 42,
    });
    expect(body.data[0]).toMatchObject({
      slug: "sample-manga",
      description: "A sample description",
      coverUrl: "https://moetruyen.net/uploads/covers/sample-manga.webp?t=123",
      status: "ongoing",
      commentCount: 5,
      groupName: "Test Team",
    });
  });

  it("parses enum-style manga hasChapters query values", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    mangaService.listPublicManga = async (query) => {
      receivedQuery = query as Record<string, unknown>;
      return { items: [], total: 0 };
    };

    const response = await app.request("http://local/v1/manga?hasChapters=1");

    expect(response.status).toBe(200);
    expect(receivedQuery).toMatchObject({ hasChapters: 1 });
  });

  it("validates manga hasChapters enum values", async () => {
    const response = await app.request("http://local/v1/manga?hasChapters=true");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns paginated top manga rankings by period", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    mangaService.listTopPublicManga = async (query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            id: 2,
            slug: "top-manga",
            title: "Top Manga",
            description: "Top manga description",
            author: "Author",
            status: "ongoing",
            cover: "/uploads/covers/top-manga.webp",
            coverUrl: "https://moetruyen.net/uploads/covers/top-manga.webp?t=456",
            coverUpdatedAt: "2026-03-22T10:47:03.891Z",
            groupName: "Top Team",
            updatedAt: "2026-03-22T10:47:03.891Z",
            createdAt: "2026-03-20T10:47:03.891Z",
            commentCount: 20,
            latestChapterNumber: 120,
            latestChapterNumberText: "120.000",
            chapterCount: 120,
            isOneshot: false,
            genres: [{ id: 11, name: "Action" }],
            rank: 2,
            totalViews: 9876,
          },
        ],
        total: 12,
      };
    };

    const response = await app.request("http://local/v1/manga/top?sort_by=views&time=7d&page=2&limit=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.mangaTop);
    expect(receivedQuery).toMatchObject({
      sort_by: "views",
      time: "7d",
      page: 2,
      limit: 1,
    });
    expect(body.meta.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 12,
      totalPages: 12,
    });
    expect(body.data[0]).toMatchObject({
      slug: "top-manga",
      rank: 2,
      totalViews: 9876,
    });
  });

  it("validates top manga ranking time", async () => {
    const response = await app.request("http://local/v1/manga/top?time=yearly");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("validates top manga ranking sort_by", async () => {
    const response = await app.request("http://local/v1/manga/top?sort_by=likes");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns random manga with default limit", async () => {
    let receivedQuery: Record<string, unknown> | undefined;
    let detailRouteCalled = false;

    mangaService.listRandomPublicManga = async (query) => {
      receivedQuery = query as Record<string, unknown>;

      return [
        {
          id: 31,
          slug: "random-one",
          title: "Random One",
          description: "A random description",
          author: "Author",
          status: "ongoing",
          cover: "/uploads/covers/random-one.webp",
          coverUrl: "https://moetruyen.net/uploads/covers/random-one.webp?t=123",
          coverUpdatedAt: "2026-03-22T10:47:03.891Z",
          groupName: "Random Team",
          updatedAt: "2026-03-22T10:47:03.891Z",
          createdAt: "2026-03-20T10:47:03.891Z",
          commentCount: 3,
          latestChapterNumber: 12,
          latestChapterNumberText: "12.000",
          chapterCount: 12,
          isOneshot: false,
          genres: [{ id: 1, name: "Drama" }],
        },
      ];
    };
    mangaService.getPublicMangaById = async () => {
      detailRouteCalled = true;
      return null;
    };

    const response = await app.request("http://local/v1/manga/random");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.mangaRandom);
    expect(receivedQuery).toMatchObject({ limit: 1 });
    expect(detailRouteCalled).toBe(false);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ slug: "random-one", description: "A random description" });
  });

  it("passes custom random manga limits", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    mangaService.listRandomPublicManga = async (query) => {
      receivedQuery = query as Record<string, unknown>;
      return [];
    };

    const response = await app.request("http://local/v1/manga/random?limit=3");

    expect(response.status).toBe(200);
    expect(receivedQuery).toMatchObject({ limit: 3 });
  });

  it("validates random manga limit", async () => {
    const response = await app.request("http://local/v1/manga/random?limit=11");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
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

  it("returns public manga detail with full description", async () => {
    mangaService.getPublicMangaById = async () => ({
      id: 1,
      slug: "sample-manga",
      title: "Sample Manga",
      description: "Full manga description",
      author: "Author",
      status: "ongoing",
      cover: "/uploads/covers/sample-manga.webp",
      coverUrl: "https://moetruyen.net/uploads/covers/sample-manga.webp?t=123",
      coverUpdatedAt: "2026-03-22T10:47:03.891Z",
      updatedAt: "2026-03-22T10:47:03.891Z",
      createdAt: "2026-03-20T10:47:03.891Z",
      commentCount: 14,
      totalViews: 12345,
      totalFollows: 67,
      latestChapterNumber: 12,
      latestChapterNumberText: "12.000",
      chapterCount: 12,
      isOneshot: false,
      groupName: "Test Team",
      genres: [{ id: 10, name: "Drama" }],
    });

    const response = await app.request("http://local/v1/manga/1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.mangaDetail);
    expect(body.data).toMatchObject({
      slug: "sample-manga",
      description: "Full manga description",
      groupName: "Test Team",
      commentCount: 14,
      totalViews: 12345,
      totalFollows: 67,
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
          groupName: "HUST Electro Neko Team",
          viewCount: 321,
          access: "public",
        },
        {
          id: 100,
          number: 4,
          numberText: "4.000",
          title: "Chapter 4",
          date: "2026-03-22T10:47:03.891Z",
          pages: 20,
          groupName: null,
          viewCount: 99,
          access: "password_required",
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
      groupName: "HUST Electro Neko Team",
      viewCount: 321,
      access: "public",
    });
    expect(body.data.chapters[1]).toMatchObject({
      id: 100,
      viewCount: 99,
      access: "password_required",
    });
  });

  it("returns chapter reader payloads", async () => {
    chapterService.getPublicChapterReaderById = async () => ({
      kind: "ok",
      data: {
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
          access: "public",
          groupName: "Test Group",
          viewCount: 321,
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
          access: "password_required",
        },
        nextChapter: null,
      },
    });

    const response = await app.request("http://local/v1/chapters/99");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.pageUrls).toHaveLength(2);
    expect(body.data.prevChapter).toMatchObject({ id: 98, number: 2, access: "password_required" });
    expect(body.data.chapter).toMatchObject({ id: 99, groupName: "Test Group", viewCount: 321, access: "public" });
  });

  it("returns 404 when chapter reader payload is missing", async () => {
    chapterService.getPublicChapterReaderById = async () => ({ kind: "not_found" });

    const response = await app.request("http://local/v1/chapters/99");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "CHAPTER_NOT_FOUND",
      message: "Chapter not found",
    });
  });

  it("returns 403 when a chapter requires a password", async () => {
    chapterService.getPublicChapterReaderById = async () => ({
      kind: "forbidden",
      reason: "password_required",
    });

    const response = await app.request("http://local/v1/chapters/99");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatchObject({
      code: "PASSWORD_REQUIRED",
      message: "Password required to access this chapter",
    });
  });

  it("returns 403 when a chapter is locked", async () => {
    chapterService.getPublicChapterReaderById = async () => ({
      kind: "forbidden",
      reason: "locked",
    });

    const response = await app.request("http://local/v1/chapters/99");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatchObject({
      code: "CHAPTER_LOCKED",
      message: "Chapter is locked",
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

  it("returns public team detail", async () => {
    teamService.getPublicTeamById = async () => ({
      id: 16,
      slug: "hust-electro-neko-team",
      name: "HUST Electro Neko Team",
      intro: "Public-safe intro",
      avatarUrl: "https://example.com/team-avatar.png",
      coverUrl: "https://example.com/team-cover.png",
      memberCount: 7,
      leaderCount: 1,
      totalMangaCount: 12,
      totalChapterCount: 98,
      totalCommentCount: 54,
    });

    const response = await app.request("http://local/v1/teams/16");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.teamDetail);
    expect(body.data).toMatchObject({
      slug: "hust-electro-neko-team",
      memberCount: 7,
      totalMangaCount: 12,
    });
  });

  it("returns paginated public team list", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    teamService.listPublicTeams = async (query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            id: 16,
            slug: "hust-electro-neko-team",
            name: "HUST Electro Neko Team",
            intro: "Public-safe intro",
            avatarUrl: "https://example.com/team-avatar.png",
            coverUrl: "https://example.com/team-cover.png",
            memberCount: 7,
            leaderCount: 1,
            totalMangaCount: 12,
            totalChapterCount: 98,
            totalCommentCount: 54,
          },
        ],
        total: 3,
      };
    };

    const response = await app.request("http://local/v1/teams?q=neko&sort=member_count&limit=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.teamList);
    expect(receivedQuery).toMatchObject({
      page: 1,
      limit: 1,
      q: "neko",
      sort: "member_count",
    });
    expect(body.meta.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 3,
      totalPages: 3,
    });
    expect(body.data[0]).toMatchObject({
      slug: "hust-electro-neko-team",
      memberCount: 7,
      totalCommentCount: 54,
    });
  });

  it("validates public team list sort", async () => {
    const response = await app.request("http://local/v1/teams?sort=name");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when public team detail is missing", async () => {
    teamService.getPublicTeamById = async () => null;

    const response = await app.request("http://local/v1/teams/999999");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "TEAM_NOT_FOUND",
      message: "Team not found",
    });
  });

  it("returns public team members", async () => {
    teamService.listPublicTeamMembersByTeamId = async () => [
      {
        username: "hust_electro_neko",
        displayName: "HUST Electro Neko",
        avatarUrl: "https://example.com/member-avatar.png",
        role: "leader",
        roleLabel: "Leader",
      },
    ];

    const response = await app.request("http://local/v1/teams/16/members");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.teamMembers);
    expect(body.data[0]).toMatchObject({
      username: "hust_electro_neko",
      role: "leader",
    });
  });

  it("returns paginated public team updates", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    teamService.listPublicTeamUpdatesByTeamId = async (_id, query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            manga: {
              id: 77,
              slug: "sample-team-manga",
              title: "Sample Team Manga",
            },
            chapter: {
              id: 901,
              number: 21,
              numberText: "21.000",
              title: "Chapter 21",
              date: "2026-03-22T10:47:03.891Z",
              pages: 18,
              access: "password_required",
              isOneshot: false,
              groupName: "HUST Electro Neko Team",
            },
          },
        ],
        total: 4,
      };
    };

    const response = await app.request("http://local/v1/teams/16/updates?limit=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.teamUpdates);
    expect(receivedQuery).toMatchObject({
      page: 1,
      limit: 1,
    });
    expect(body.meta.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 4,
      totalPages: 4,
    });
    expect(body.data[0]).toMatchObject({
      manga: {
        slug: "sample-team-manga",
      },
      chapter: {
        access: "password_required",
      },
    });
  });

  it("returns 404 when public team updates are missing", async () => {
    teamService.listPublicTeamUpdatesByTeamId = async () => null;

    const response = await app.request("http://local/v1/teams/999999/updates");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "TEAM_NOT_FOUND",
      message: "Team not found",
    });
  });

  it("returns paginated public team manga", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    teamService.listPublicTeamMangaByTeamId = async (_id, query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            id: 77,
            slug: "sample-team-manga",
            title: "Sample Team Manga",
            description: "A team manga description",
            author: "Author",
            status: "ongoing",
            cover: "/uploads/covers/sample-team-manga.webp",
            coverUrl: "https://moetruyen.net/uploads/covers/sample-team-manga.webp?t=456",
            coverUpdatedAt: "2026-03-22T10:47:03.891Z",
            groupName: "HUST Electro Neko Team",
            updatedAt: "2026-03-22T10:47:03.891Z",
            createdAt: "2026-03-20T10:47:03.891Z",
            commentCount: 9,
            latestChapterNumber: 21,
            latestChapterNumberText: "21.000",
            chapterCount: 21,
            isOneshot: false,
            genres: [{ id: 2, name: "Action" }],
          },
        ],
        total: 3,
      };
    };

    const response = await app.request("http://local/v1/teams/16/manga?limit=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.teamMangaList);
    expect(receivedQuery).toMatchObject({
      page: 1,
      limit: 1,
      sort: "updated_at",
    });
    expect(body.meta.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 3,
      totalPages: 3,
    });
    expect(body.data[0]).toMatchObject({
      slug: "sample-team-manga",
      description: "A team manga description",
      chapterCount: 21,
    });
  });

  it("returns paginated recent public comments", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    commentService.listRecentPublicComments = async (query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            id: 101,
            content: "Comment content",
            contentPreview: "Comment content",
            createdAt: "2026-03-22T10:47:03.891Z",
            commentPage: 1,
            commentPath: "/manga/sample-manga#comment-101",
            author: {
              name: "Tester",
              username: "tester",
              userId: "u1",
              avatarUrl: "https://example.com/avatar.png",
            },
            manga: {
              id: 1,
              slug: "sample-manga",
              title: "Sample Manga",
            },
            chapter: null,
          },
        ],
        total: 2,
      };
    };

    const response = await app.request("http://local/v1/comments/recent?order=asc&limit=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.recentComments);
    expect(receivedQuery).toMatchObject({
      page: 1,
      limit: 1,
      sort: "created_at",
      order: "asc",
    });
    expect(body.meta.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect(body.data[0]).toMatchObject({
      id: 101,
      commentPath: "/manga/sample-manga#comment-101",
    });
  });

  it("returns paginated manga-level comments only", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    commentService.listPublicMangaCommentsByMangaId = async (_id, query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            id: 201,
            content: "Manga comment",
            createdAt: "2026-03-22T10:47:03.891Z",
            commentPath: "/manga/sample-manga#comment-201",
            author: {
              name: "Tester",
              username: "tester",
              userId: "u1",
              avatarUrl: "https://example.com/avatar.png",
            },
            replies: [
              {
                id: 202,
                content: "Reply",
                createdAt: "2026-03-22T11:47:03.891Z",
                commentPath: "/manga/sample-manga#comment-202",
                author: {
                  name: "Responder",
                  username: "responder",
                  userId: "u2",
                  avatarUrl: null,
                },
              },
            ],
          },
        ],
        total: 1,
      };
    };

    const response = await app.request("http://local/v1/comments/manga/1?limit=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.mangaComments);
    expect(receivedQuery).toMatchObject({
      page: 1,
      limit: 1,
      sort: "created_at",
      order: "desc",
    });
    expect(body.meta.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1,
    });
    expect(body.data[0]).toMatchObject({
      id: 201,
      replies: [{ id: 202 }],
    });
  });

  it("returns 404 when manga comments target is missing", async () => {
    commentService.listPublicMangaCommentsByMangaId = async () => null;

    const response = await app.request("http://local/v1/comments/manga/999999");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "MANGA_NOT_FOUND",
      message: "Manga not found",
    });
  });

  it("returns paginated public chapter comments", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    commentService.listPublicChapterCommentsByChapterId = async (_id, query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            id: 301,
            content: "Chapter comment",
            createdAt: "2026-03-22T10:47:03.891Z",
            commentPath: "/manga/sample-manga/chapters/3.000#comment-301",
            author: {
              name: "Tester",
              username: "tester",
              userId: "u1",
              avatarUrl: "https://example.com/avatar.png",
            },
            replies: [],
          },
        ],
        total: 4,
      };
    };

    const response = await app.request("http://local/v1/comments/chapters/99?limit=2&order=asc");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.chapterComments);
    expect(receivedQuery).toMatchObject({
      page: 1,
      limit: 2,
      sort: "created_at",
      order: "asc",
    });
    expect(body.meta.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 4,
      totalPages: 2,
    });
    expect(body.data[0]).toMatchObject({
      id: 301,
      commentPath: "/manga/sample-manga/chapters/3.000#comment-301",
    });
  });

  it("returns 404 when chapter comments target is missing", async () => {
    commentService.listPublicChapterCommentsByChapterId = async () => ({ kind: "not_found" });

    const response = await app.request("http://local/v1/comments/chapters/999999");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "CHAPTER_NOT_FOUND",
      message: "Chapter not found",
    });
  });

  it("returns 403 when chapter comments require a password", async () => {
    commentService.listPublicChapterCommentsByChapterId = async () => ({ kind: "forbidden", reason: "password_required" });

    const response = await app.request("http://local/v1/comments/chapters/99");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatchObject({
      code: "PASSWORD_REQUIRED",
      message: "Password required to access this chapter",
    });
  });

  it("returns 403 when chapter comments are locked", async () => {
    commentService.listPublicChapterCommentsByChapterId = async () => ({ kind: "forbidden", reason: "locked" });

    const response = await app.request("http://local/v1/comments/chapters/99");
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toMatchObject({
      code: "CHAPTER_LOCKED",
      message: "Chapter is locked",
    });
  });

  it("validates comment sort query params", async () => {
    const response = await app.request("http://local/v1/comments/recent?sort=id");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 when public team manga is missing", async () => {
    teamService.listPublicTeamMangaByTeamId = async () => null;

    const response = await app.request("http://local/v1/teams/999999/manga");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "TEAM_NOT_FOUND",
      message: "Team not found",
    });
  });

  it("returns public user detail", async () => {
    userService.getPublicUserByUsername = async () => ({
      username: "hust_electro_neko",
      displayName: "HUST Electro Neko",
      avatarUrl: "https://example.com/user-avatar.png",
      bio: "Reader and translator",
      joinedAt: "2026-03-22T10:47:03.891Z",
      commentCount: 42,
      team: {
        id: 16,
        slug: "hust-electro-neko-team",
        name: "HUST Electro Neko Team",
        role: "leader",
        roleLabel: "Leader",
      },
    });

    const response = await app.request("http://local/v1/users/hust_electro_neko");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.userDetail);
    expect(body.data).toMatchObject({
      username: "hust_electro_neko",
      commentCount: 42,
      team: {
        slug: "hust-electro-neko-team",
      },
    });
  });

  it("returns paginated public user comments", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    userService.listPublicUserCommentsByUsername = async (_username, query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        items: [
          {
            id: 88,
            kind: "manga_comment",
            targetTitle: "Sample Manga",
            contextLabel: "Chapter 3.000 - Chapter 3",
            contentPreview: "Nice chapter",
            commentPath: "/manga/sample-manga/chapters/3.000#comment-88",
            createdAt: "2026-03-22T10:47:03.891Z",
          },
        ],
        total: 5,
      };
    };

    const response = await app.request("http://local/v1/users/hust_electro_neko/comments?limit=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CACHE_CONTROL.userComments);
    expect(receivedQuery).toMatchObject({
      page: 1,
      limit: 1,
    });
    expect(body.meta.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 5,
      totalPages: 5,
    });
    expect(body.data[0]).toMatchObject({
      kind: "manga_comment",
      targetTitle: "Sample Manga",
    });
  });

  it("returns 404 when public user comments are missing", async () => {
    userService.listPublicUserCommentsByUsername = async () => null;

    const response = await app.request("http://local/v1/users/missing_user/comments");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "USER_NOT_FOUND",
      message: "User not found",
    });
  });

  it("validates user route params", async () => {
    const response = await app.request("http://local/v1/users/Not-Valid");
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("normalizes user route params before lookup", async () => {
    let receivedUsername: string | undefined;

    userService.getPublicUserByUsername = async (username) => {
      receivedUsername = username;

      return {
        username: "hust_electro_neko",
        displayName: null,
        avatarUrl: null,
        bio: null,
        joinedAt: null,
        commentCount: 0,
        team: null,
      };
    };

    const response = await app.request("http://local/v1/users/HUST_ELECTRO_NEKO");

    expect(response.status).toBe(200);
    expect(receivedUsername).toBe("hust_electro_neko");
  });

  it("returns 404 when public user detail is missing", async () => {
    userService.getPublicUserByUsername = async () => null;

    const response = await app.request("http://local/v1/users/missing_user");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "USER_NOT_FOUND",
      message: "User not found",
    });
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
        updatedAt: "2026-03-22T10:47:03.891Z",
        createdAt: "2026-03-20T10:47:03.891Z",
        commentCount: 7,
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
      commentCount: 7,
    });
    expect(body.data[0]).not.toHaveProperty("description");
  });
});
