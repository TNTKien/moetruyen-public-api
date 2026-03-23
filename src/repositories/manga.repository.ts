import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import type { MangaDetail, MangaListItem, MangaListQuery, MangaRandomQuery } from "../contracts/manga.js";
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

const buildGroupNameMatchFilter = (groupName: string): SQL<unknown> => sql`
  (
    lower(trim(coalesce(${manga.groupName}, ''))) = lower(trim(${groupName}))
    OR (
      ',' ||
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(lower(trim(coalesce(${manga.groupName}, ''))), ' / ', ','),
                        '/',
                        ','
                      ),
                      ' & ',
                      ','
                    ),
                    '&',
                    ','
                  ),
                  ' + ',
                  ','
                ),
                '+',
                ','
              ),
              ';',
              ','
            ),
            '|',
            ','
          ),
          ', ',
          ','
        ),
        ' ,',
        ','
      ) || ','
    ) LIKE ('%,' || lower(trim(${groupName})) || ',%')
    OR lower(coalesce(${manga.groupName}, '')) LIKE ('%' || lower(trim(${groupName})) || '%')
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

const shuffleArray = <T>(items: T[]): T[] => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentItem = shuffled[index] as T;
    shuffled[index] = shuffled[swapIndex] as T;
    shuffled[swapIndex] = currentItem;
  }

  return shuffled;
};

const mapPublicMangaItems = async (
  rows: Array<{
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
  }>,
): Promise<MangaListItem[]> => {
  const genresByMangaId = await mapMangaGenres(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...mapBaseMangaFields(row),
    genres: genresByMangaId.get(row.id) ?? [],
  }));
};

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
  private async listPublicMangaByIds(ids: number[]): Promise<MangaListItem[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await db
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
      .where(and(eq(manga.isHidden, 0), inArray(manga.id, ids)));

    const items = await mapPublicMangaItems(rows);
    const itemsById = new Map(items.map((item) => [item.id, item]));

    return ids.map((id) => itemsById.get(id)).filter((item): item is MangaListItem => Boolean(item));
  }

  private async listPublicMangaWithConditions(query: MangaListQuery, conditions: SQL<unknown>[]): Promise<PublicMangaListResult> {
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

    return {
      items: await mapPublicMangaItems(items),
      total,
    };
  }

  async listPublicManga(query: MangaListQuery): Promise<PublicMangaListResult> {
    const conditions = buildMangaConditions(query);
    return this.listPublicMangaWithConditions(query, conditions);
  }

  async listPublicMangaByGroupName(groupName: string, query: MangaListQuery): Promise<PublicMangaListResult> {
    const normalizedGroupName = groupName.trim();
    const conditions = [...buildMangaConditions(query), buildGroupNameMatchFilter(normalizedGroupName)];

    return this.listPublicMangaWithConditions(query, conditions);
  }

  async listRandomPublicManga(query: MangaRandomQuery): Promise<MangaListItem[]> {
    const boundsRows = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(manga)
      .where(eq(manga.isHidden, 0));

    const bounds = boundsRows[0];
    const totalVisible = bounds?.total ?? 0;

    if (totalVisible === 0) {
      return [];
    }

    const targetCount = Math.min(query.limit, totalVisible);

    if (totalVisible <= targetCount) {
      const allVisibleRows = await db
        .select({ id: manga.id })
        .from(manga)
        .where(eq(manga.isHidden, 0))
        .orderBy(asc(manga.id))
        .limit(targetCount);

      return this.listPublicMangaByIds(shuffleArray(allVisibleRows.map((row) => row.id)));
    }

    const selectedOffsets = new Set<number>();

    while (selectedOffsets.size < targetCount) {
      selectedOffsets.add(Math.floor(Math.random() * totalVisible));
    }

    const offsetRows = await Promise.all(
      [...selectedOffsets].map((offset) =>
        db
          .select({ id: manga.id })
          .from(manga)
          .where(eq(manga.isHidden, 0))
          .orderBy(asc(manga.id))
          .limit(1)
          .offset(offset),
      ),
    );

    const selectedIds = offsetRows.map((rows) => rows[0]?.id).filter((id): id is number => typeof id === "number");

    return this.listPublicMangaByIds(shuffleArray(selectedIds));
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
