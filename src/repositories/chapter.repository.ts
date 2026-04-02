import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { ChapterAggregateItem, ChapterItem, ChapterListQuery, ChapterReader, MangaChapterAggregateList, PaginatedMangaChapterListResult } from "../contracts/chapter.js";
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

const chapterViewCountExpr = sql<number>`
  coalesce(
    (
      select sum(coalesce(cvs.view_count, 0))
      from chapter_view_stats cvs
      where cvs.chapter_id = ${chapters.id}
    ),
    0
  )
`.mapWith(Number);

const chapterCountExpr = sql<number>`count(*)`.mapWith(Number);

const normalizeChapterDateInput = (value: string | Date | null): string | null => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};

const mapChapterListItem = (
  chapter: {
    id: number;
    number: string;
    title: string | null;
    date: string | Date | null;
    pages: number | null;
    groupName: string | null;
    viewCount: number;
    passwordHash: string | null;
    isOneshot: boolean;
  },
  mangaOneshotLocked: boolean,
): ChapterItem => ({
  id: chapter.id,
  number: parseNumericValue(chapter.number) ?? 0,
  numberText: formatNumericText(chapter.number),
  title: chapter.title,
  date: toIsoDateString(normalizeChapterDateInput(chapter.date)),
  pages: chapter.pages,
  groupName: chapter.groupName,
  viewCount: chapter.viewCount,
  access: getPublicChapterAccess({
    chapterPasswordHash: chapter.passwordHash,
    chapterIsOneshot: chapter.isOneshot,
    mangaOneshotLocked,
  }),
});

const mapChapterAggregateItem = (
  chapter: {
    id: number;
    number: string;
    title: string | null;
    date: string | Date | null;
    passwordHash: string | null;
    isOneshot: boolean;
  },
  mangaOneshotLocked: boolean,
): ChapterAggregateItem => ({
  id: chapter.id,
  number: parseNumericValue(chapter.number) ?? 0,
  numberText: formatNumericText(chapter.number),
  title: chapter.title,
  date: toIsoDateString(normalizeChapterDateInput(chapter.date)),
  access: getPublicChapterAccess({
    chapterPasswordHash: chapter.passwordHash,
    chapterIsOneshot: chapter.isOneshot,
    mangaOneshotLocked,
  }),
});

export class ChapterRepository {
  private async findPublicMangaChapterHeader(mangaId: number) {
    return db
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
  }

  async listPublicChaptersByMangaId(mangaId: number, query: ChapterListQuery): Promise<PaginatedMangaChapterListResult | null> {
    const mangaRow = await this.findPublicMangaChapterHeader(mangaId);

    if (!mangaRow) {
      return null;
    }

    const offset = (query.page - 1) * query.limit;

    const [countRow, chapterItems] = await Promise.all([
      db
        .select({ total: chapterCountExpr })
        .from(chapters)
        .where(eq(chapters.mangaId, mangaRow.id))
        .then((rows) => rows[0]?.total ?? 0),
      db
        .select({
          id: chapters.id,
          number: chapters.number,
          title: chapters.title,
          date: chapters.date,
          pages: chapters.pages,
          groupName: chapters.groupName,
          viewCount: chapterViewCountExpr,
          passwordHash: chapters.passwordHash,
          isOneshot: chapters.isOneshot,
        })
        .from(chapters)
        .where(eq(chapters.mangaId, mangaRow.id))
        .orderBy(desc(chapters.number), desc(chapters.id))
        .limit(query.limit)
        .offset(offset),
    ]);

    return {
      manga: {
        id: mangaRow.id,
        slug: mangaRow.slug,
        title: mangaRow.title,
      },
      chapters: chapterItems.map((chapter) => mapChapterListItem(chapter, mangaRow.oneshotLocked)),
      total: countRow,
    };
  }

  async listAggregatePublicChaptersByMangaId(mangaId: number): Promise<MangaChapterAggregateList | null> {
    const mangaItem = await this.findPublicMangaChapterHeader(mangaId);

    if (!mangaItem) {
      return null;
    }

    const chapterItems = await db
      .select({
        id: chapters.id,
        number: chapters.number,
        title: chapters.title,
        date: chapters.date,
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
      chapters: chapterItems.map((chapter) => mapChapterAggregateItem(chapter, mangaItem.oneshotLocked)),
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
        chapterViewCount: chapterViewCountExpr,
        chapterPagesPrefix: chapters.pagesPrefix,
        chapterPagesExt: chapters.pagesExt,
        chapterPagesFilePrefix: chapters.pagesFilePrefix,
        chapterPagesUpdatedAt: chapters.pagesUpdatedAt,
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
            viewCount: chapterRow.chapterViewCount,
            isOneshot: chapterRow.chapterIsOneshot,
          },
        pageUrls: buildChapterPageUrls({
          pages: chapterRow.chapterPages,
          pagesPrefix: chapterRow.chapterPagesPrefix,
          pagesExt: chapterRow.chapterPagesExt,
          pagesFilePrefix: chapterRow.chapterPagesFilePrefix,
          pagesUpdatedAt: chapterRow.chapterPagesUpdatedAt,
        }),
        prevChapter: prevChapter ? mapChapterNavigation(prevChapter) : null,
        nextChapter: nextChapter ? mapChapterNavigation(nextChapter) : null,
      },
    };
  }
}

export const chapterRepository = new ChapterRepository();
