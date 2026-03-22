import { and, asc, desc, eq } from "drizzle-orm";

import type { ChapterReader, MangaChapterList } from "../contracts/chapter.js";
import { db } from "../db/client.js";
import { chapters } from "../db/schema/chapters.js";
import { manga } from "../db/schema/manga.js";
import { buildChapterPageUrls, formatNumericText, parseNumericValue, toIsoDateString } from "../lib/public-content.js";

const mapChapterNavigation = (chapter: { id: number; number: string; title: string }) => ({
  id: chapter.id,
  number: parseNumericValue(chapter.number) ?? 0,
  numberText: formatNumericText(chapter.number),
  title: chapter.title,
});

export class ChapterRepository {
  async listPublicChaptersByMangaId(mangaId: number): Promise<MangaChapterList | null> {
    const mangaItem = await db
      .select({
        id: manga.id,
        slug: manga.slug,
        title: manga.title,
      })
      .from(manga)
      .where(and(eq(manga.id, mangaId), eq(manga.isHidden, 0)))
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

  async getPublicChapterReaderById(chapterId: number): Promise<ChapterReader | null> {
    const chapterRow = await db
      .select({
        mangaId: manga.id,
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        mangaIsHidden: manga.isHidden,
        oneshotLocked: manga.oneshotLocked,
        chapterId: chapters.id,
        chapterNumber: chapters.number,
        chapterTitle: chapters.title,
        chapterDate: chapters.date,
        chapterPages: chapters.pages,
        chapterGroupName: chapters.groupName,
        chapterPagesPrefix: chapters.pagesPrefix,
        chapterPagesExt: chapters.pagesExt,
        chapterPagesFilePrefix: chapters.pagesFilePrefix,
        chapterIsOneshot: chapters.isOneshot,
        chapterPasswordHash: chapters.passwordHash,
      })
      .from(chapters)
      .innerJoin(manga, eq(manga.id, chapters.mangaId))
      .where(and(eq(chapters.id, chapterId), eq(manga.isHidden, 0)))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!chapterRow) {
      return null;
    }

    if (chapterRow.chapterPasswordHash || chapterRow.oneshotLocked) {
      return null;
    }

    const mangaChapters = await db
      .select({
        id: chapters.id,
        number: chapters.number,
        title: chapters.title,
      })
      .from(chapters)
      .where(eq(chapters.mangaId, chapterRow.mangaId))
      .orderBy(asc(chapters.number), asc(chapters.id));

    const currentIndex = mangaChapters.findIndex((chapter) => chapter.id === chapterRow.chapterId);
    const prevChapter = currentIndex > 0 ? mangaChapters[currentIndex - 1] : null;
    const nextChapter = currentIndex >= 0 && currentIndex < mangaChapters.length - 1 ? mangaChapters[currentIndex + 1] : null;

    return {
      manga: {
        id: chapterRow.mangaId,
        slug: chapterRow.mangaSlug,
        title: chapterRow.mangaTitle,
      },
      chapter: {
        id: chapterRow.chapterId,
        number: parseNumericValue(chapterRow.chapterNumber) ?? 0,
        numberText: formatNumericText(chapterRow.chapterNumber),
        title: chapterRow.chapterTitle,
        date: toIsoDateString(chapterRow.chapterDate),
        pages: chapterRow.chapterPages,
        groupName: chapterRow.chapterGroupName,
        isOneshot: chapterRow.chapterIsOneshot,
      },
      pageUrls: buildChapterPageUrls({
        pages: chapterRow.chapterPages,
        pagesPrefix: chapterRow.chapterPagesPrefix,
        pagesExt: chapterRow.chapterPagesExt,
        pagesFilePrefix: chapterRow.chapterPagesFilePrefix,
      }),
      prevChapter: prevChapter ? mapChapterNavigation(prevChapter) : null,
      nextChapter: nextChapter ? mapChapterNavigation(nextChapter) : null,
    };
  }
}

export const chapterRepository = new ChapterRepository();
