import { afterEach, describe, expect, it } from "bun:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/test";
process.env.API_BASE_URL = "http://localhost:8787";
process.env.PUBLIC_SITE_URL = "https://example.com";
process.env.COVER_BASE_URL = "https://moetruyen.net";
process.env.CHAPTER_CDN_BASE_URL = "https://i.moetruyen.net";
process.env.ALLOWED_ORIGINS = "https://example.com";

const { chapterRepository } = await import("../src/repositories/chapter.repository.js");
const { teamRepository } = await import("../src/repositories/team.repository.js");
const { chapterService } = await import("../src/services/chapter.service.js");

const originalList = chapterRepository.listPublicChaptersByMangaId;
const originalResolve = teamRepository.resolvePublicGroupsByMangaIds;

afterEach(() => {
  chapterRepository.listPublicChaptersByMangaId = originalList;
  teamRepository.resolvePublicGroupsByMangaIds = originalResolve;
});

describe("chapter service", () => {
  it("matches chapter groups only against exact linked-team tokens", async () => {
    chapterRepository.listPublicChaptersByMangaId = async () => ({
      manga: { id: 1, slug: "sample", title: "Sample" },
      chapters: [
        { id: 1, groupName: "BBBTranslation", groups: [] },
        { id: 2, groupName: "An / BBBTranslation", groups: [] },
      ],
      total: 2,
    }) as never;
    teamRepository.resolvePublicGroupsByMangaIds = async () => new Map([
      [1, [{ id: 361, name: "An" }, { id: 7, name: "BBBTranslation" }]],
    ]);

    const result = await chapterService.listPublicChaptersByMangaId(1, { page: 1, limit: 20 });

    expect(result?.chapters[0]?.groups).toEqual([{ id: 7, name: "BBBTranslation" }]);
    expect(result?.chapters[1]?.groups).toEqual([
      { id: 361, name: "An" },
      { id: 7, name: "BBBTranslation" },
    ]);
  });
});
