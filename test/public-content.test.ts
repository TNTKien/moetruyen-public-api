import { describe, expect, it } from "bun:test";

process.env.NODE_ENV = "test";
process.env.PORT = "8787";
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/test";
process.env.API_BASE_URL = "http://localhost:8787";
process.env.PUBLIC_SITE_URL = "https://example.com";
process.env.COVER_BASE_URL = "https://moetruyen.net";
process.env.CHAPTER_CDN_BASE_URL = "https://i.moetruyen.net";
process.env.ALLOWED_ORIGINS = "https://example.com";
process.env.LOG_LEVEL = "info";

const {
  buildChapterAssetUrl,
  buildChapterPageFileName,
  buildChapterPageUrls,
  buildCoverUrl,
  normalizeSearchTerm,
} = await import("../src/lib/public-content.js");

describe("public content helpers", () => {
  it("normalizes search terms", () => {
    expect(normalizeSearchTerm("  foo   bar   baz  ")).toBe("foo bar baz");
    expect(normalizeSearchTerm("x".repeat(120), 80)).toHaveLength(80);
  });

  it("builds cover urls with cache tokens", () => {
    expect(buildCoverUrl("/uploads/covers/demo.webp", 1774173891595)).toBe(
      "https://moetruyen.net/uploads/covers/demo.webp?t=1774173891595",
    );
  });

  it("builds chapter asset urls from the chapter cdn base", () => {
    expect(buildChapterAssetUrl("/chapters/manga-1/ch-1/001.webp")).toBe(
      "https://i.moetruyen.net/chapters/manga-1/ch-1/001.webp",
    );
    expect(buildChapterAssetUrl("/chapters/manga-1/ch-1/001.webp", 1774927339347)).toBe(
      "https://i.moetruyen.net/chapters/manga-1/ch-1/001.webp?t=1774927339347",
    );
  });

  it("builds chapter page filenames with optional page suffixes", () => {
    expect(buildChapterPageFileName({ pageNumber: 1, padLength: 3, extension: "webp", pageFilePrefix: "abcde" })).toBe(
      "001_abcde.webp",
    );
    expect(buildChapterPageFileName({ pageNumber: 12, padLength: 3, extension: ".jpg", pageFilePrefix: "bad" })).toBe(
      "012.jpg",
    );
  });

  it("builds chapter page urls from chapter asset fields", () => {
    expect(
      buildChapterPageUrls({
        pages: 3,
        pagesPrefix: "chapters/manga-1/ch-1",
        pagesExt: "webp",
        pagesFilePrefix: "abcde",
        pagesUpdatedAt: 1774927339347,
      }),
    ).toEqual([
      "https://i.moetruyen.net/chapters/manga-1/ch-1/001_abcde.webp?t=1774927339347",
      "https://i.moetruyen.net/chapters/manga-1/ch-1/002_abcde.webp?t=1774927339347",
      "https://i.moetruyen.net/chapters/manga-1/ch-1/003_abcde.webp?t=1774927339347",
    ]);
  });
});
