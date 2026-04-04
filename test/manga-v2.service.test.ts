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

const { mangaV2Service } = await import("../src/services/manga-v2.service.js");
const { mangaService } = await import("../src/services/manga.service.js");
const { mangaRepository } = await import("../src/repositories/manga.repository.js");
const { teamRepository } = await import("../src/repositories/team.repository.js");

const originals = {
  listTopPublicManga: mangaService.listTopPublicManga,
  getPublicMangaStatsByIds: mangaRepository.getPublicMangaStatsByIds,
  resolvePublicGroupsByNames: teamRepository.resolvePublicGroupsByNames,
};

afterEach(() => {
  mangaService.listTopPublicManga = originals.listTopPublicManga;
  mangaRepository.getPublicMangaStatsByIds = originals.getPublicMangaStatsByIds;
  teamRepository.resolvePublicGroupsByNames = originals.resolvePublicGroupsByNames;
});

const rankedTopItem = {
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
  groups: [{ id: 7, name: "Test Team" }],
  altTitles: ["Tên khác 1", "Tên khác 2"],
  createdAt: "2026-03-20T10:47:03.891Z",
  updatedAt: "2026-03-22T10:47:03.891Z",
  commentCount: 14,
  latestChapterNumber: 12,
  latestChapterNumberText: "12.000",
  chapterCount: 12,
  isOneshot: false,
  genres: [{ id: 1, name: "Action" }],
  rank: 1,
  rankingValue: 55,
};

describe("manga v2 service", () => {
  it("maps bookmark ranking values for top manga", async () => {
    mangaService.listTopPublicManga = async () => ({
      items: [rankedTopItem],
      total: 1,
    });

    teamRepository.resolvePublicGroupsByNames = async () => new Map([
      ["Test Team", [{ id: 7, name: "Test Team" }]],
    ]);

    mangaRepository.getPublicMangaStatsByIds = async () => new Map([
      [
        1,
        {
          commentCount: 14,
          totalViews: 12345,
          bookmarkCount: 55,
        },
      ],
    ]);

    const result = await mangaV2Service.listTopPublicManga({
      page: 1,
      limit: 10,
      sort_by: "bookmarks",
      time: "all_time",
      include: ["stats", "genres"],
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 1,
      altTitles: ["Tên khác 1", "Tên khác 2"],
      genres: [{ id: 1, name: "Action" }],
      stats: {
        commentCount: 14,
        totalViews: 12345,
        bookmarkCount: 55,
      },
      ranking: {
        rank: 1,
        sortBy: "bookmarks",
        time: "all_time",
        value: 55,
      },
    });
  });

  it("defaults bookmark ranking time to all_time when omitted", async () => {
    mangaService.listTopPublicManga = async (query) => ({
      items: [{
        ...rankedTopItem,
        rankingValue: 55,
      }],
      total: query.time === "all_time" ? 1 : 0,
    });

    teamRepository.resolvePublicGroupsByNames = async () => new Map([
      ["Test Team", [{ id: 7, name: "Test Team" }]],
    ]);

    mangaRepository.getPublicMangaStatsByIds = async () => new Map([
      [
        1,
        {
          commentCount: 14,
          totalViews: 12345,
          bookmarkCount: 55,
        },
      ],
    ]);

    const result = await mangaV2Service.listTopPublicManga({
      page: 1,
      limit: 10,
      sort_by: "bookmarks",
      include: ["stats"],
    });

    expect(result.items[0]?.ranking.time).toBe("all_time");
  });

  it("maps comments ranking values for top manga", async () => {
    mangaService.listTopPublicManga = async () => ({
      items: [{
        ...rankedTopItem,
        rankingValue: 14,
      }],
      total: 1,
    });

    teamRepository.resolvePublicGroupsByNames = async () => new Map([
      ["Test Team", [{ id: 7, name: "Test Team" }]],
    ]);

    mangaRepository.getPublicMangaStatsByIds = async () => new Map([
      [
        1,
        {
          commentCount: 14,
          totalViews: 12345,
          bookmarkCount: 55,
        },
      ],
    ]);

    const result = await mangaV2Service.listTopPublicManga({
      page: 1,
      limit: 10,
      sort_by: "comments",
      time: "all_time",
      include: ["stats", "genres"],
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 1,
      stats: {
        commentCount: 14,
        totalViews: 12345,
        bookmarkCount: 55,
      },
      ranking: {
        rank: 1,
        sortBy: "comments",
        time: "all_time",
        value: 14,
      },
    });
  });

  it("includes groups only when requested", async () => {
    mangaService.listTopPublicManga = async () => ({
      items: [{
        ...rankedTopItem,
        rankingValue: 55,
      }],
      total: 1,
    });

    teamRepository.resolvePublicGroupsByNames = async () => new Map([
      ["Test Team", [{ id: 7, name: "Test Team" }]],
    ]);

    mangaRepository.getPublicMangaStatsByIds = async () => new Map();

    const result = await mangaV2Service.listTopPublicManga({
      page: 1,
      limit: 10,
      sort_by: "bookmarks",
      time: "all_time",
      include: ["groups"],
    });

    expect(result.items[0]).toMatchObject({
      groups: [{ id: 7, name: "Test Team" }],
      altTitles: ["Tên khác 1", "Tên khác 2"],
      ranking: {
        sortBy: "bookmarks",
      },
    });
  });

  it("defaults comments ranking time to all_time when omitted", async () => {
    mangaService.listTopPublicManga = async (query) => ({
      items: [{
        ...rankedTopItem,
        rankingValue: 14,
      }],
      total: query.time === "all_time" ? 1 : 0,
    });

    teamRepository.resolvePublicGroupsByNames = async () => new Map([
      ["Test Team", [{ id: 7, name: "Test Team" }]],
    ]);

    mangaRepository.getPublicMangaStatsByIds = async () => new Map([
      [
        1,
        {
          commentCount: 14,
          totalViews: 12345,
          bookmarkCount: 55,
        },
      ],
    ]);

    const result = await mangaV2Service.listTopPublicManga({
      page: 1,
      limit: 10,
      sort_by: "comments",
      include: ["stats"],
    });

    expect(result.items[0]?.ranking.time).toBe("all_time");
  });
});
