import { and, asc, desc, eq } from "drizzle-orm";

import type { ChapterReader, MangaChapterList } from "../contracts/chapter.js";
import { db } from "../db/client.js";
import { chapters } from "../db/schema/chapters.js";
import { manga } from "../db/schema/manga.js";
import { getPublicChapterAccess, type PublicChapterAccess } from "../lib/chapter-access.js";
import { buildChapterPageUrls, formatNumericText, parseNumericValue, toIsoDateString } from "../lib/public-content.js";

export type ChapterReaderLookupResult =
  | { kind: "ok"; data: ChapterReader }
  | { kind: "not_found" }
  | { kind: "forbidden"; reason: Exclude<PublicChapterAccess, "public"> };

const mapChapterNavigation = (chapter: { id: number; number: string; title: string; access: PublicChapterAccess }) => ({
  id: chapter.id,
  number: parseNumericValue(chapter.number) ?? 0,
  numberText: formatNumericText(chapter.number),
  title: chapter.title,
  access: chapter.access,
});

export class ChapterRepository {
  async listPublicChaptersByMangaId(mangaId: number): Promise<MangaChapterList | null> {
    const mangaItem = await db
      .select({
        id: manga.id,
        slug: manga.slug,
        title: manga.title,
        oneshotLocked: manga.oneshotLocked,
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
        passwordHash: chapters.passwordHash,
        isOneshot: chapters.isOneshot,
      })
      .from(chapters)
      .where(eq(chapters.mangaId, mangaItem.id))
      .orderBy(desc(chapters.number), desc(chapters.id));

    return {
      manga: {
        id: mangaItem.id,
        slug: mangaItem.slug,
        title: mangaItem.title,
      },
      chapters: chapterItems.map((chapter) => ({
        id: chapter.id,
        number: parseNumericValue(chapter.number) ?? 0,
        numberText: formatNumericText(chapter.number),
        title: chapter.title,
        date: toIsoDateString(chapter.date),
        pages: chapter.pages,
        access: getPublicChapterAccess({
          chapterPasswordHash: chapter.passwordHash,
          chapterIsOneshot: chapter.isOneshot,
          mangaOneshotLocked: mangaItem.oneshotLocked,
        }),
      })),
    };
  }

  async getPublicChapterReaderById(chapterId: number): Promise<ChapterReaderLookupResult> {
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
      return { kind: "not_found" };
    }

    const chapterAccess = getPublicChapterAccess({
      chapterPasswordHash: chapterRow.chapterPasswordHash,
      chapterIsOneshot: chapterRow.chapterIsOneshot,
      mangaOneshotLocked: chapterRow.oneshotLocked,
    });

    if (chapterAccess !== "public") {
      return {
        kind: "forbidden",
        reason: chapterAccess,
      };
    }

    const mangaChapters = await db
      .select({
        id: chapters.id,
        number: chapters.number,
        title: chapters.title,
        passwordHash: chapters.passwordHash,
        isOneshot: chapters.isOneshot,
      })
      .from(chapters)
      .where(eq(chapters.mangaId, chapterRow.mangaId))
      .orderBy(asc(chapters.number), asc(chapters.id));

    const navigableChapters = mangaChapters.map((chapter) => ({
      ...chapter,
      access: getPublicChapterAccess({
        chapterPasswordHash: chapter.passwordHash,
        chapterIsOneshot: chapter.isOneshot,
        mangaOneshotLocked: chapterRow.oneshotLocked,
      }),
    }));

    const currentIndex = navigableChapters.findIndex((chapter) => chapter.id === chapterRow.chapterId);
    const prevChapter = currentIndex > 0 ? navigableChapters[currentIndex - 1] : null;
    const nextChapter =
      currentIndex >= 0 && currentIndex < navigableChapters.length - 1 ? navigableChapters[currentIndex + 1] : null;

    return {
      kind: "ok",
      data: {
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
          access: "public",
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
      },
    };
  }
}

export const chapterRepository = new ChapterRepository();
