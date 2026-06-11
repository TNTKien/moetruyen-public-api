import { and, eq, notInArray, type SQL } from "drizzle-orm";

import { env } from "../config/env.js";
import { manga } from "../db/schema/manga.js";
import { buildPublicMangaVisibilitySql } from "./hidden-manga.js";

export const hiddenMangaIds = env.HIDDEN_MANGA_IDS;

export const publicMangaVisibilityFilter = (): SQL<unknown> => {
  const conditions: SQL<unknown>[] = [eq(manga.isHidden, 0)];

  if (hiddenMangaIds.length > 0) {
    conditions.push(notInArray(manga.id, hiddenMangaIds));
  }

  return and(...conditions) as SQL<unknown>;
};

export const publicMangaVisibilitySql = (mangaRef = "m"): string => buildPublicMangaVisibilitySql(mangaRef, hiddenMangaIds);
