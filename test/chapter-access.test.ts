import { describe, expect, it } from "bun:test";

const { filterAccessibleChapters, isPublicChapterAccessible } = await import("../src/lib/chapter-access.ts");

describe("chapter access rules", () => {
  it("blocks password-protected chapters", () => {
    expect(
      isPublicChapterAccessible({
        chapterPasswordHash: "secret-hash",
        chapterIsOneshot: false,
        mangaOneshotLocked: false,
      }),
    ).toBe(false);
  });

  it("blocks oneshot chapters when the manga oneshot lock is enabled", () => {
    expect(
      isPublicChapterAccessible({
        chapterPasswordHash: null,
        chapterIsOneshot: true,
        mangaOneshotLocked: true,
      }),
    ).toBe(false);
  });

  it("keeps normal chapters accessible even when oneshot locking is enabled", () => {
    expect(
      isPublicChapterAccessible({
        chapterPasswordHash: null,
        chapterIsOneshot: false,
        mangaOneshotLocked: true,
      }),
    ).toBe(true);
  });

  it("filters inaccessible chapters while preserving chapter order", () => {
    const chapterItems = [
      { id: 1, passwordHash: null, isOneshot: false },
      { id: 2, passwordHash: "secret", isOneshot: false },
      { id: 3, passwordHash: null, isOneshot: true },
      { id: 4, passwordHash: null, isOneshot: false },
    ];

    expect(filterAccessibleChapters(chapterItems, true).map((chapter) => chapter.id)).toEqual([1, 4]);
  });
});
