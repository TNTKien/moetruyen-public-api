export type HiddenMangaIdsParseResult =
  | { ok: true; value: number[] }
  | { ok: false; message: string };

export const HIDDEN_MANGA_IDS_PARSE_ERROR = "HIDDEN_MANGA_IDS must contain comma-separated positive integer IDs";

const positiveIntegerPattern = /^[1-9]\d*$/;

export const parseHiddenMangaIds = (value: string | undefined): HiddenMangaIdsParseResult => {
  const normalizedValue = (value ?? "").trim();

  if (!normalizedValue) {
    return { ok: true, value: [] };
  }

  const ids: number[] = [];
  const seen = new Set<number>();

  for (const rawToken of normalizedValue.split(",")) {
    const token = rawToken.trim();

    if (!positiveIntegerPattern.test(token)) {
      return { ok: false, message: HIDDEN_MANGA_IDS_PARSE_ERROR };
    }

    const id = Number(token);

    if (!Number.isSafeInteger(id)) {
      return { ok: false, message: HIDDEN_MANGA_IDS_PARSE_ERROR };
    }

    if (!seen.has(id)) {
      ids.push(id);
      seen.add(id);
    }
  }

  return { ok: true, value: ids };
};

export const buildPublicMangaVisibilitySql = (mangaRef: string, hiddenMangaIds: readonly number[]): string => {
  const ref = mangaRef.trim();
  const baseClause = `COALESCE(${ref}.is_hidden, 0) = 0`;

  if (hiddenMangaIds.length === 0) {
    return baseClause;
  }

  return `${baseClause} AND ${ref}.id NOT IN (${hiddenMangaIds.join(", ")})`;
};
