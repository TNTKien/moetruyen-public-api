import { describe, expect, it } from "bun:test";

const { getPublicChapterAccess, isProcessingChapterState, isPublicChapterAccessible } = await import("../src/lib/chapter-access.js");

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

  it("blocks interaction-boosted chapters", () => {
    expect(
      isPublicChapterAccessible({
        chapterPasswordHash: null,
        chapterInteractionBoostEnabled: true,
        chapterIsOneshot: false,
        mangaOneshotLocked: false,
      }),
    ).toBe(false);
    expect(
      getPublicChapterAccess({
        chapterPasswordHash: null,
        chapterInteractionBoostEnabled: true,
        chapterIsOneshot: false,
        mangaOneshotLocked: false,
      }),
    ).toBe("interaction_boost_enabled");
  });

  it("keeps password protection ahead of interaction boost", () => {
    expect(
      getPublicChapterAccess({
        chapterPasswordHash: "secret-hash",
        chapterInteractionBoostEnabled: true,
        chapterIsOneshot: true,
        mangaOneshotLocked: true,
      }),
    ).toBe("password_required");
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

  it("detects processing chapter states", () => {
    expect(isProcessingChapterState("processing")).toBe(true);
    expect(isProcessingChapterState(" Processing ")).toBe(true);
    expect(isProcessingChapterState("completed")).toBe(false);
    expect(isProcessingChapterState(null)).toBe(false);
  });
});
