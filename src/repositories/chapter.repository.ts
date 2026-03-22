import { and, desc, eq } from "drizzle-orm";

import type { MangaChapterList } from "../contracts/chapter.js";
import { db } from "../db/client.js";
import { chapters } from "../db/schema/chapters.js";
import { manga } from "../db/schema/manga.js";
import { formatNumericText, parseNumericValue, toIsoDateString } from "../lib/public-content.js";

export class ChapterRepository {
  async listPublicChaptersByMangaSlug(slug: string): Promise<MangaChapterList | null> {
    const mangaItem = await db
      .select({
        id: manga.id,
        slug: manga.slug,
        title: manga.title,
      })
      .from(manga)
      .where(and(eq(manga.slug, slug), eq(manga.isHidden, 0)))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!mangaItem) {
      return null;
    }

    const chapterItems = await db
      .select({
        id: chapters.id,
        number: chapters.number,
        title: chapters.title,
        date: chapters.date,
        pages: chapters.pages,
      })
      .from(chapters)
      .where(eq(chapters.mangaId, mangaItem.id))
      .orderBy(desc(chapters.number), desc(chapters.id));

    return {
      manga: mangaItem,
      chapters: chapterItems.map((chapter) => ({
        id: chapter.id,
        number: parseNumericValue(chapter.number) ?? 0,
        numberText: formatNumericText(chapter.number),
        title: chapter.title,
        date: toIsoDateString(chapter.date),
        pages: chapter.pages,
      })),
    };
  }
}

export const chapterRepository = new ChapterRepository();
