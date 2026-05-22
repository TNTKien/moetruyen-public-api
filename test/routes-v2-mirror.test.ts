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
const { chapterService } = await import("../src/services/chapter.service.js");
const { commentService } = await import("../src/services/comment.service.js");
const { genreService } = await import("../src/services/genre.service.js");
const { teamService } = await import("../src/services/team.service.js");
const { userService } = await import("../src/services/user.service.js");

const originals = {
  listPublicChaptersByMangaId: chapterService.listPublicChaptersByMangaId,
  listAggregatePublicChaptersByMangaId: chapterService.listAggregatePublicChaptersByMangaId,
  getPublicChapterReaderById: chapterService.getPublicChapterReaderById,
  getPublicChapterPageAccessById: chapterService.getPublicChapterPageAccessById,
  listRecentPublicComments: commentService.listRecentPublicComments,
  listPublicMangaCommentsByMangaId: commentService.listPublicMangaCommentsByMangaId,
  listPublicChapterCommentsByChapterId: commentService.listPublicChapterCommentsByChapterId,
  listPublicGenres: genreService.listPublicGenres,
  listPublicTeams: teamService.listPublicTeams,
  getPublicTeamById: teamService.getPublicTeamById,
  listPublicTeamMembersByTeamId: teamService.listPublicTeamMembersByTeamId,
  listPublicTeamUpdatesByTeamId: teamService.listPublicTeamUpdatesByTeamId,
  getPublicUserByUsername: userService.getPublicUserByUsername,
  listPublicUserCommentsByUsername: userService.listPublicUserCommentsByUsername,
};

afterEach(() => {
  chapterService.listPublicChaptersByMangaId = originals.listPublicChaptersByMangaId;
  chapterService.listAggregatePublicChaptersByMangaId = originals.listAggregatePublicChaptersByMangaId;
  chapterService.getPublicChapterReaderById = originals.getPublicChapterReaderById;
  chapterService.getPublicChapterPageAccessById = originals.getPublicChapterPageAccessById;
  commentService.listRecentPublicComments = originals.listRecentPublicComments;
  commentService.listPublicMangaCommentsByMangaId = originals.listPublicMangaCommentsByMangaId;
  commentService.listPublicChapterCommentsByChapterId = originals.listPublicChapterCommentsByChapterId;
  genreService.listPublicGenres = originals.listPublicGenres;
  teamService.listPublicTeams = originals.listPublicTeams;
  teamService.getPublicTeamById = originals.getPublicTeamById;
  teamService.listPublicTeamMembersByTeamId = originals.listPublicTeamMembersByTeamId;
  teamService.listPublicTeamUpdatesByTeamId = originals.listPublicTeamUpdatesByTeamId;
  userService.getPublicUserByUsername = originals.getPublicUserByUsername;
  userService.listPublicUserCommentsByUsername = originals.listPublicUserCommentsByUsername;
});

describe("public api v2 mirrored routes", () => {
  it("returns v2 manga chapter list", async () => {
    let receivedQuery: Record<string, unknown> | undefined;

    chapterService.listPublicChaptersByMangaId = async (_mangaId, query) => {
      receivedQuery = query as Record<string, unknown>;

      return {
        manga: {
          id: 1,
          slug: "sample-manga",
          title: "Sample Manga",
        },
        chapters: [],
        total: 35,
      };
    };

    const response = await app.request("http://local/v2/manga/1/chapters?page=2&limit=10");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(receivedQuery).toMatchObject({
      page: 2,
      limit: 10,
    });
    expect(body.meta.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 35,
      totalPages: 4,
    });
  });

  it("returns v2 aggregate manga chapter list", async () => {
    chapterService.listAggregatePublicChaptersByMangaId = async () => ({
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
          access: "public",
        },
      ],
    });

    const response = await app.request("http://local/v2/manga/1/chapters/aggregate");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.chapters[0]).toEqual({
      id: 99,
      number: 3,
      numberText: "3.000",
      title: "Chapter 3",
      date: "2026-03-22T10:47:03.891Z",
      access: "public",
    });
  });

  it("returns v2 chapter reader payload", async () => {
    chapterService.getPublicChapterReaderById = async () => ({
      kind: "ok",
      data: {
        chapter: {
          id: 99,
          number: 3,
          numberText: "3.000",
          title: "Chapter 3",
          date: "2026-03-22T10:47:03.891Z",
          pages: 2,
          access: "public",
          groupName: "Test Group",
          groups: [{ id: 9, name: "Test Group" }],
          viewCount: 321,
          isOneshot: false,
        },
        manga: {
          id: 1,
          slug: "sample-manga",
          title: "Sample Manga",
        },
        pageUrls: [],
        prevChapter: null,
        nextChapter: null,
      },
    });

    const response = await app.request("http://local/v2/chapters/99");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.chapter.groups).toEqual([{ id: 9, name: "Test Group" }]);
  });

  it("returns v2 IMGX page-access grants", async () => {
    let receivedChapterId: number | undefined;
    let receivedPageIndexes: number[] | undefined;

    chapterService.getPublicChapterPageAccessById = async (chapterId, pageIndexes) => {
      receivedChapterId = chapterId;
      receivedPageIndexes = pageIndexes;

      return {
        kind: "ok",
        data: {
          chapterId,
          ttlMs: 60_000,
          maxWindow: 5,
          pages: [
            {
              pageIndex: 0,
              pageNumber: 1,
              storageKey: "chapters/manga-873/ch-52/001_ysXot.js",
              downloadUrl: "https://i.moetruyen.net/chapters/manga-873/ch-52/001_ysXot.js?t=1779440034633",
              grant: {
                version: 2,
                algorithm: "IMGX-HMAC-SHA256-v2",
                imageId: "image-id",
                issuedAt: 1_779_440_000_000,
                expiresAt: 1_779_440_060_000,
                nonce: "nonce",
                keyNonce: "key-nonce",
                keyHash: "key-hash",
                signature: "signature",
                wrappedDecodeKey: "wrapped-key",
              },
            },
          ],
        },
      };
    };

    const response = await app.request("http://local/v2/chapters/99/page-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pageIndexes: [0, 1] }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(receivedChapterId).toBe(99);
    expect(receivedPageIndexes).toEqual([0, 1]);
    expect(body.data.pages[0]).toMatchObject({
      pageIndex: 0,
      pageNumber: 1,
      storageKey: "chapters/manga-873/ch-52/001_ysXot.js",
      grant: {
        algorithm: "IMGX-HMAC-SHA256-v2",
        wrappedDecodeKey: "wrapped-key",
      },
    });
  });

  it("returns v2 recent comments", async () => {
    commentService.listRecentPublicComments = async () => ({ items: [], total: 0 });
    const response = await app.request("http://local/v2/comments/recent");
    expect(response.status).toBe(200);
  });

  it("returns v2 manga comments", async () => {
    commentService.listPublicMangaCommentsByMangaId = async () => ({ items: [], total: 0 });
    const response = await app.request("http://local/v2/comments/manga/1");
    expect(response.status).toBe(200);
  });

  it("returns v2 chapter comments", async () => {
    commentService.listPublicChapterCommentsByChapterId = async () => ({ items: [], total: 0 });
    const response = await app.request("http://local/v2/comments/chapters/99");
    expect(response.status).toBe(200);
  });

  it("returns v2 genres", async () => {
    genreService.listPublicGenres = async () => [];
    const response = await app.request("http://local/v2/genres");
    expect(response.status).toBe(200);
  });

  it("returns v2 team list", async () => {
    teamService.listPublicTeams = async () => ({ items: [], total: 0 });
    const response = await app.request("http://local/v2/teams");
    expect(response.status).toBe(200);
  });

  it("returns v2 team detail", async () => {
    teamService.getPublicTeamById = async () => ({
      id: 16,
      slug: "team",
      name: "Team",
      intro: null,
      avatarUrl: null,
      coverUrl: null,
      memberCount: 1,
      leaderCount: 1,
      totalMangaCount: 0,
      totalChapterCount: 0,
      totalCommentCount: 0,
    });
    const response = await app.request("http://local/v2/teams/16");
    expect(response.status).toBe(200);
  });

  it("returns v2 team members", async () => {
    teamService.listPublicTeamMembersByTeamId = async () => [];
    const response = await app.request("http://local/v2/teams/16/members");
    expect(response.status).toBe(200);
  });

  it("returns v2 team updates", async () => {
    teamService.listPublicTeamUpdatesByTeamId = async () => ({ items: [], total: 0 });
    const response = await app.request("http://local/v2/teams/16/updates");
    expect(response.status).toBe(200);
  });

  it("returns v2 user detail", async () => {
    userService.getPublicUserByUsername = async () => ({
      username: "tester",
      displayName: "Tester",
      avatarUrl: null,
      bio: null,
      joinedAt: null,
      commentCount: 0,
      team: null,
    });
    const response = await app.request("http://local/v2/users/tester");
    expect(response.status).toBe(200);
  });

  it("returns v2 user comments", async () => {
    userService.listPublicUserCommentsByUsername = async () => ({ items: [], total: 0 });
    const response = await app.request("http://local/v2/users/tester/comments");
    expect(response.status).toBe(200);
  });
});
