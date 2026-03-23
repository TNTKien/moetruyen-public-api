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
const { teamService } = await import("../src/services/team.service.ts");
const { userService } = await import("../src/services/user.service.ts");

const originals = {
  listPublicManga: mangaService.listPublicManga,
  listRandomPublicManga: mangaService.listRandomPublicManga,
  getPublicMangaById: mangaService.getPublicMangaById,
  listPublicChaptersByMangaId: chapterService.listPublicChaptersByMangaId,
  getPublicChapterReaderById: chapterService.getPublicChapterReaderById,
  listPublicGenres: genreService.listPublicGenres,
  searchPublicManga: searchService.searchPublicManga,
  getPublicTeamById: teamService.getPublicTeamById,
  listPublicTeamUpdatesByTeamId: teamService.listPublicTeamUpdatesByTeamId,
  listPublicTeamMangaByTeamId: teamService.listPublicTeamMangaByTeamId,
  listPublicTeamMembersByTeamId: teamService.listPublicTeamMembersByTeamId,
  getPublicUserByUsername: userService.getPublicUserByUsername,
  listPublicUserCommentsByUsername: userService.listPublicUserCommentsByUsername,
};

afterEach(() => {
  mangaService.listPublicManga = originals.listPublicManga;
  mangaService.listRandomPublicManga = originals.listRandomPublicManga;
  mangaService.getPublicMangaById = originals.getPublicMangaById;
  chapterService.listPublicChaptersByMangaId = originals.listPublicChaptersByMangaId;
  chapterService.getPublicChapterReaderById = originals.getPublicChapterReaderById;
  genreService.listPublicGenres = originals.listPublicGenres;
  searchService.searchPublicManga = originals.searchPublicManga;
  teamService.getPublicTeamById = originals.getPublicTeamById;
  teamService.listPublicTeamUpdatesByTeamId = originals.listPublicTeamUpdatesByTeamId;
  teamService.listPublicTeamMangaByTeamId = originals.listPublicTeamMangaByTeamId;
  teamService.listPublicTeamMembersByTeamId = originals.listPublicTeamMembersByTeamId;
  userService.getPublicUserByUsername = originals.getPublicUserByUsername;
  userService.listPublicUserCommentsByUsername = originals.listPublicUserCommentsByUsername;
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
          author: "Author",
          status: "ongoing",
          cover: "/uploads/covers/random-one.webp",
          coverUrl: "https://moetruyen.net/uploads/covers/random-one.webp?t=123",
          coverUpdatedAt: "2026-03-22T10:47:03.891Z",
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
    expect(body.data[0]).toMatchObject({ slug: "random-one" });
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
          access: "public",
        },
        {
          id: 100,
          number: 4,
          numberText: "4.000",
          title: "Chapter 4",
          date: "2026-03-22T10:47:03.891Z",
          pages: 20,
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
      access: "public",
    });
    expect(body.data.chapters[1]).toMatchObject({
      id: 100,
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
    expect(body.data.chapter).toMatchObject({ id: 99, groupName: "Test Group", access: "public" });
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
            author: "Author",
            status: "ongoing",
            cover: "/uploads/covers/sample-team-manga.webp",
            coverUrl: "https://moetruyen.net/uploads/covers/sample-team-manga.webp?t=456",
            coverUpdatedAt: "2026-03-22T10:47:03.891Z",
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
      chapterCount: 21,
    });
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
