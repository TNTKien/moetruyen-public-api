import { describe, expect, it } from "bun:test";

const { getPublicChapterAccess, isPublicChapterAccessible } = await import("../src/lib/chapter-access.ts");

describe("chapter access rules", () => {
  it("blocks password-protected chapters", () => {
    expect(
      isPublicChapterAccessible({
        chapterPasswordHash: "secret-hash",
        chapterIsOneshot: false,
        mangaOneshotLocked: false,
      }),
    ).toBe(false);
    expect(
      getPublicChapterAccess({
        chapterPasswordHash: "secret-hash",
        chapterIsOneshot: false,
        mangaOneshotLocked: false,
      }),
    ).toBe("password_required");
  });

  it("blocks oneshot chapters when the manga oneshot lock is enabled", () => {
    expect(
      isPublicChapterAccessible({
        chapterPasswordHash: null,
        chapterIsOneshot: true,
        mangaOneshotLocked: true,
      }),
    ).toBe(false);
    expect(
      getPublicChapterAccess({
        chapterPasswordHash: null,
        chapterIsOneshot: true,
        mangaOneshotLocked: true,
      }),
    ).toBe("locked");
  });

  it("keeps normal chapters accessible even when oneshot locking is enabled", () => {
    expect(
      isPublicChapterAccessible({
        chapterPasswordHash: null,
        chapterIsOneshot: false,
        mangaOneshotLocked: true,
      }),
    ).toBe(true);
    expect(
      getPublicChapterAccess({
        chapterPasswordHash: null,
        chapterIsOneshot: false,
        mangaOneshotLocked: true,
      }),
    ).toBe("public");
  });
});
