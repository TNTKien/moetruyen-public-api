import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import type { MangaDetail, MangaListItem, MangaListQuery } from "../contracts/manga.js";
import type { SearchMangaItem, SearchMangaQuery } from "../contracts/search.js";
import { db } from "../db/client.js";
import { chapters } from "../db/schema/chapters.js";
import { genres, mangaGenres } from "../db/schema/genres.js";
import { manga } from "../db/schema/manga.js";
import {
  buildCoverUrl,
  formatNumericText,
  normalizeMangaStatus,
  normalizeSearchTerm,
  parseNumericValue,
  toIsoDateString,
  type PublicMangaStatus,
} from "../lib/public-content.js";

export interface PublicMangaListResult {
  items: MangaListItem[];
  total: number;
}

const chapterStats = db
  .select({
    mangaId: chapters.mangaId,
    latestChapterNumber: sql<string | null>`max(${chapters.number})`.as("latestChapterNumber"),
    chapterCount: sql<number>`count(${chapters.id})`.mapWith(Number).as("chapterCount"),
  })
  .from(chapters)
  .groupBy(chapters.mangaId)
  .as("chapter_stats");

const buildStatusFilter = (status: PublicMangaStatus): SQL<unknown> => {
  const loweredStatus = sql`lower(coalesce(${manga.status}, ''))`;

  switch (status) {
    case "ongoing":
      return sql`${loweredStatus} = 'ongoing'`;
    case "completed":
      return sql`${loweredStatus} = 'completed'`;
    case "hiatus":
      return sql`${loweredStatus} = 'hiatus'`;
    case "cancelled":
      return sql`${loweredStatus} in ('cancelled', 'canceled', 'dropped')`;
    case "unknown":
      return sql`${loweredStatus} = '' or ${loweredStatus} not in ('ongoing', 'completed', 'hiatus', 'cancelled', 'canceled', 'dropped')`;
  }
};

const buildSearchFilter = (query: string): SQL<unknown> => {
  const searchTerm = `%${normalizeSearchTerm(query)}%`;

  return or(ilike(manga.title, searchTerm), ilike(manga.slug, searchTerm), ilike(manga.otherNames, searchTerm)) as SQL<unknown>;
};

const buildGenreFilter = (genreName: string): SQL<unknown> => sql`
  exists (
    select 1
    from ${mangaGenres}
    inner join ${genres} on ${genres.id} = ${mangaGenres.genreId}
    where ${mangaGenres.mangaId} = ${manga.id}
      and lower(${genres.name}) = lower(${genreName})
  )
`;

const mapMangaGenres = async (mangaIds: number[]) => {
  if (mangaIds.length === 0) {
    return new Map<number, MangaListItem["genres"]>();
  }

  const rows = await db
    .select({
      mangaId: mangaGenres.mangaId,
      id: genres.id,
      name: genres.name,
    })
    .from(mangaGenres)
    .innerJoin(genres, eq(genres.id, mangaGenres.genreId))
    .where(inArray(mangaGenres.mangaId, mangaIds))
    .orderBy(asc(genres.name));

  const byMangaId = new Map<number, MangaListItem["genres"]>();

  for (const row of rows) {
    const currentGenres = byMangaId.get(row.mangaId) ?? [];

    currentGenres.push({
      id: row.id,
      name: row.name,
    });

    byMangaId.set(row.mangaId, currentGenres);
  }

  return byMangaId;
};

const mapBaseMangaFields = (row: {
  id: number;
  slug: string;
  title: string;
  author: string;
  status: string | null;
  cover: string | null;
  coverUpdatedAt: number | null;
  latestChapterNumber: string | null;
  chapterCount: number;
  isOneshot: boolean;
}) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  author: row.author,
  status: normalizeMangaStatus(row.status),
  cover: row.cover,
  coverUrl: buildCoverUrl(row.cover, row.coverUpdatedAt),
  coverUpdatedAt: toIsoDateString(row.coverUpdatedAt),
  latestChapterNumber: parseNumericValue(row.latestChapterNumber),
  latestChapterNumberText: formatNumericText(row.latestChapterNumber),
  chapterCount: row.chapterCount,
  isOneshot: row.isOneshot,
});

const buildMangaConditions = (query: Pick<MangaListQuery, "q" | "genre" | "status">): SQL<unknown>[] => {
  const conditions: SQL<unknown>[] = [eq(manga.isHidden, 0)];

  if (query.q) {
    conditions.push(buildSearchFilter(query.q));
  }

  if (query.genre) {
    conditions.push(buildGenreFilter(query.genre.trim()));
  }

  if (query.status) {
    conditions.push(buildStatusFilter(query.status));
  }

  return conditions;
};

export class MangaRepository {
  async listPublicManga(query: MangaListQuery): Promise<PublicMangaListResult> {
    const conditions = buildMangaConditions(query);
    const offset = (query.page - 1) * query.limit;

    const totalResult = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(manga)
      .where(and(...conditions));

    const total = totalResult[0]?.total ?? 0;

    const items = await db
      .select({
        id: manga.id,
        slug: manga.slug,
        title: manga.title,
        author: manga.author,
        status: manga.status,
        cover: manga.cover,
        coverUpdatedAt: manga.coverUpdatedAt,
        latestChapterNumber: chapterStats.latestChapterNumber,
        chapterCount: sql<number>`coalesce(${chapterStats.chapterCount}, 0)`.mapWith(Number),
        isOneshot: manga.isOneshot,
      })
      .from(manga)
      .leftJoin(chapterStats, eq(chapterStats.mangaId, manga.id))
      .where(and(...conditions))
      .orderBy(
        ...(query.sort === "title"
          ? [asc(manga.title), asc(manga.id)]
          : query.sort === "popular"
            ? [sql`coalesce(${chapterStats.chapterCount}, 0) desc`, desc(manga.updatedAt), desc(manga.id)]
            : [desc(manga.updatedAt), desc(manga.id)]),
      )
      .limit(query.limit)
      .offset(offset);

    const genresByMangaId = await mapMangaGenres(items.map((item) => item.id));

    return {
      items: items.map((item) => ({
        ...mapBaseMangaFields(item),
        genres: genresByMangaId.get(item.id) ?? [],
      })),
      total,
    };
  }

  async findPublicMangaById(id: number): Promise<MangaDetail | null> {
    const item = await db
      .select({
        id: manga.id,
        slug: manga.slug,
        title: manga.title,
        author: manga.author,
        status: manga.status,
        cover: manga.cover,
        coverUpdatedAt: manga.coverUpdatedAt,
        latestChapterNumber: chapterStats.latestChapterNumber,
        chapterCount: sql<number>`coalesce(${chapterStats.chapterCount}, 0)`.mapWith(Number),
        isOneshot: manga.isOneshot,
        description: manga.description,
        groupName: manga.groupName,
      })
      .from(manga)
      .leftJoin(chapterStats, eq(chapterStats.mangaId, manga.id))
      .where(and(eq(manga.id, id), eq(manga.isHidden, 0)))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!item) {
      return null;
    }

    const genresByMangaId = await mapMangaGenres([item.id]);

    return {
      ...mapBaseMangaFields(item),
      description: item.description,
      groupName: item.groupName,
      genres: genresByMangaId.get(item.id) ?? [],
    };
  }

  async searchPublicManga(query: SearchMangaQuery): Promise<SearchMangaItem[]> {
    const items = await db
      .select({
        id: manga.id,
        slug: manga.slug,
        title: manga.title,
        cover: manga.cover,
        coverUpdatedAt: manga.coverUpdatedAt,
        status: manga.status,
      })
      .from(manga)
      .where(and(eq(manga.isHidden, 0), buildSearchFilter(query.q)))
      .orderBy(desc(manga.updatedAt), desc(manga.id))
      .limit(query.limit);

    return items.map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      cover: item.cover,
      coverUrl: buildCoverUrl(item.cover, item.coverUpdatedAt),
      coverUpdatedAt: toIsoDateString(item.coverUpdatedAt),
      status: normalizeMangaStatus(item.status),
    }));
  }
}

export const mangaRepository = new MangaRepository();
