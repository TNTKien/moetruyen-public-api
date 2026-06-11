import { describe, expect, it } from "bun:test";

import { buildPublicMangaVisibilitySql, parseHiddenMangaIds } from "../src/lib/hidden-manga.js";

describe("hidden manga configuration", () => {
  it("parses comma-separated positive manga ids and removes duplicates", () => {
    expect(parseHiddenMangaIds("1195, 1193,1195,341")).toEqual({
      ok: true,
      value: [1195, 1193, 341],
    });
  });

  it("treats an empty hidden manga list as no hidden manga", () => {
    expect(parseHiddenMangaIds("")).toEqual({ ok: true, value: [] });
    expect(parseHiddenMangaIds(undefined)).toEqual({ ok: true, value: [] });
  });

  it("rejects malformed hidden manga ids", () => {
    expect(parseHiddenMangaIds("1195,abc")).toEqual({
      ok: false,
      message: "HIDDEN_MANGA_IDS must contain comma-separated positive integer IDs",
    });

    expect(parseHiddenMangaIds("1195,,1193")).toEqual({
      ok: false,
      message: "HIDDEN_MANGA_IDS must contain comma-separated positive integer IDs",
    });

    expect(parseHiddenMangaIds("0,1195")).toEqual({
      ok: false,
      message: "HIDDEN_MANGA_IDS must contain comma-separated positive integer IDs",
    });
  });

  it("builds a raw SQL visibility clause with configured hidden ids", () => {
    expect(buildPublicMangaVisibilitySql("m", [])).toBe("COALESCE(m.is_hidden, 0) = 0");
    expect(buildPublicMangaVisibilitySql("m", [1195, 1193])).toBe(
      "COALESCE(m.is_hidden, 0) = 0 AND m.id NOT IN (1195, 1193)",
    );
  });
});
