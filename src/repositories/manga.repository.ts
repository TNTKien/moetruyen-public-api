import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import type { MangaDetail, MangaListItem, MangaListQuery, MangaRandomQuery, MangaTopItem, MangaTopQuery, MangaTopTime } from "../contracts/manga.js";
import { pool } from "../db/client.js";
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

export interface PublicTopMangaListResult {
  items: MangaTopItem[];
  total: number;
}

interface TopMangaQueryRow {
  manga_id: number;
  manga_views: string | number;
}

const VIEW_STATS_TIMEZONE = "Asia/Ho_Chi_Minh";

const TOP_MANGA_TIME_DAYS: Record<MangaTopTime, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  all_time: 0,
};

const chapterStats = db
  .select({
    mangaId: chapters.mangaId,
    latestChapterNumber: sql<string | null>`max(${chapters.number})`.as("latestChapterNumber"),
    chapterCount: sql<number>`count(${chapters.id})`.mapWith(Number).as("chapterCount"),
  })
  .from(chapters)
  .groupBy(chapters.mangaId)
  .as("chapter_stats");

const visibleCommentCountExpr = sql<number>`
  coalesce(
    (
      select count(*)
      from comments c
      where c.manga_id = ${manga.id}
        and c.status = 'visible'
    ),
    0
  )
`.mapWith(Number);

const totalMangaViewsExpr = sql<number>`
  coalesce(
    (
      select sum(greatest(coalesce(v.view_count, 0), 0))
      from chapters c
      left join chapter_view_stats v on v.chapter_id = c.id
      where c.manga_id = ${manga.id}
    ),
    0
  )
`.mapWith(Number);

const totalMangaFollowsExpr = sql<number>`
  coalesce(
    (
      select count(distinct source.user_id)
      from (
        select mb.user_id
        from manga_bookmarks mb
        where mb.manga_id = ${manga.id}

        union

        select l.user_id
        from manga_bookmark_list_items li
        join manga_bookmark_lists l on l.id = li.list_id
        where li.manga_id = ${manga.id}
      ) source
      where source.user_id is not null
        and trim(source.user_id) <> ''
    ),
    0
  )
`.mapWith(Number);

const viewStatsDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VIEW_STATS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const toViewStatsDateString = (timestampMs: number): string => {
  const safeTimestamp = Number.isFinite(timestampMs) ? timestampMs : Date.now();
  const targetDate = new Date(safeTimestamp);

  try {
    const formatted = viewStatsDateFormatter.format(targetDate);

    if (isoDatePattern.test(formatted)) {
      return formatted;
    }
  } catch {
    // fallback below
  }

  return targetDate.toISOString().slice(0, 10);
};

const shiftViewStatsDateByDays = (isoDate: string, offsetDays: number): string => {
  const match = isoDate.trim().match(isoDatePattern);

  if (!match) {
    return "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (![year, month, day].every((value) => Number.isFinite(value))) {
    return "";
  }

  const shifted = new Date(Date.UTC(year, month - 1, day));
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);

  return shifted.toISOString().slice(0, 10);
};

const buildTopMangaSinceDate = (time: MangaTopTime): string => {
  const daysWindow = TOP_MANGA_TIME_DAYS[time];

  if (!daysWindow) {
    return "";
  }

  const todayDate = toViewStatsDateString(Date.now());

  if (daysWindow <= 1) {
    return todayDate;
  }

  return shiftViewStatsDateByDays(todayDate, -(daysWindow - 1));
};

const buildStatusFilter = (status: PublicMangaStatus): SQL<unknown> => {
  const loweredStatus = sql`lower(trim(coalesce(${manga.status}, '')))`;

  switch (status) {
    case "ongoing":
      return sql`${loweredStatus} in ('ongoing', 'còn tiếp')`;
    case "completed":
      return sql`${loweredStatus} in ('completed', 'hoàn thành')`;
    case "hiatus":
      return sql`${loweredStatus} in ('hiatus', 'tạm dừng')`;
    case "cancelled":
      return sql`${loweredStatus} in ('cancelled', 'canceled', 'dropped', 'đã hủy')`;
    case "unknown":
      return sql`${loweredStatus} = '' or ${loweredStatus} not in ('ongoing', 'còn tiếp', 'completed', 'hoàn thành', 'hiatus', 'tạm dừng', 'cancelled', 'canceled', 'dropped', 'đã hủy')`;
  }
};

const buildHasChaptersFilter = (hasChapters: MangaListQuery["hasChapters"]): SQL<unknown> => {
  return hasChapters === 1
    ? sql`coalesce(${chapterStats.chapterCount}, 0) = 0`
    : sql`coalesce(${chapterStats.chapterCount}, 0) > 0`;
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
  description: string | null;
  author: string;
  status: string | null;
  cover: string | null;
  coverUpdatedAt: number | null;
  groupName: string | null;
  updatedAt: string | null;
  createdAt: string | null;
  commentCount: number;
  latestChapterNumber: string | null;
  chapterCount: number;
  isOneshot: boolean;
}) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  author: row.author,
  status: normalizeMangaStatus(row.status),
  cover: row.cover,
  coverUrl: buildCoverUrl(row.cover, row.coverUpdatedAt),
  coverUpdatedAt: toIsoDateString(row.coverUpdatedAt),
  groupName: row.groupName,
  updatedAt: toIsoDateString(row.updatedAt),
  createdAt: toIsoDateString(row.createdAt),
  commentCount: row.commentCount,
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
    description: string | null;
    author: string;
    status: string | null;
    cover: string | null;
    coverUpdatedAt: number | null;
    updatedAt: string | null;
    createdAt: string | null;
    commentCount: number;
    latestChapterNumber: string | null;
    chapterCount: number;
    isOneshot: boolean;
    groupName: string | null;
  }>,
): Promise<MangaListItem[]> => {
  const genresByMangaId = await mapMangaGenres(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...mapBaseMangaFields(row),
    genres: genresByMangaId.get(row.id) ?? [],
  }));
};

const buildMangaConditions = (query: Pick<MangaListQuery, "q" | "genre" | "status"> & { hasChapters?: MangaListQuery["hasChapters"] }): SQL<unknown>[] => {
  const conditions: SQL<unknown>[] = [eq(manga.isHidden, 0), buildHasChaptersFilter(query.hasChapters ?? 0)];

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
        description: manga.description,
        author: manga.author,
        status: manga.status,
        cover: manga.cover,
        coverUpdatedAt: manga.coverUpdatedAt,
        groupName: manga.groupName,
        updatedAt: manga.updatedAt,
        createdAt: manga.createdAt,
        commentCount: visibleCommentCountExpr,
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
      .leftJoin(chapterStats, eq(chapterStats.mangaId, manga.id))
      .where(and(...conditions));

    const total = totalResult[0]?.total ?? 0;

    const items = await db
      .select({
        id: manga.id,
        slug: manga.slug,
        title: manga.title,
        description: manga.description,
        author: manga.author,
        status: manga.status,
        cover: manga.cover,
        coverUpdatedAt: manga.coverUpdatedAt,
        groupName: manga.groupName,
        updatedAt: manga.updatedAt,
        createdAt: manga.createdAt,
        commentCount: visibleCommentCountExpr,
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

  private async listTopPublicMangaByViews(query: MangaTopQuery): Promise<PublicTopMangaListResult> {
    const offset = (query.page - 1) * query.limit;
    const sinceDate = buildTopMangaSinceDate(query.time);

    const totalSql = query.time === "all_time"
      ? `
          WITH chapter_totals AS (
            SELECT
              c.manga_id,
              SUM(GREATEST(COALESCE(v.view_count, 0), 0))::bigint AS chapter_total_views
            FROM chapters c
            LEFT JOIN chapter_view_stats v ON v.chapter_id = c.id
            GROUP BY c.manga_id
          ),
          ranked AS (
            SELECT
              m.id AS manga_id,
              COALESCE(chapter_totals.chapter_total_views, 0)::bigint AS manga_views
            FROM manga m
            LEFT JOIN chapter_totals ON chapter_totals.manga_id = m.id
            WHERE COALESCE(m.is_hidden, 0) = 0
              AND EXISTS (SELECT 1 FROM chapters c_has WHERE c_has.manga_id = m.id)
          )
          SELECT COUNT(*)::bigint AS total
          FROM ranked
        `
      : `
          WITH period_totals AS (
            SELECT
              stats.manga_id,
              SUM(GREATEST(COALESCE(stats.view_count, 0), 0))::bigint AS period_views
            FROM manga_view_daily_stats stats
            WHERE stats.view_date >= $1
            GROUP BY stats.manga_id
          ),
          chapter_totals AS (
            SELECT
              c.manga_id,
              SUM(GREATEST(COALESCE(v.view_count, 0), 0))::bigint AS chapter_total_views
            FROM chapters c
            LEFT JOIN chapter_view_stats v ON v.chapter_id = c.id
            GROUP BY c.manga_id
          ),
          ranked AS (
            SELECT
              m.id AS manga_id,
              LEAST(
                COALESCE(period_totals.period_views, 0),
                COALESCE(chapter_totals.chapter_total_views, 0)
              )::bigint AS manga_views
            FROM manga m
            LEFT JOIN period_totals ON period_totals.manga_id = m.id
            LEFT JOIN chapter_totals ON chapter_totals.manga_id = m.id
            WHERE COALESCE(m.is_hidden, 0) = 0
              AND EXISTS (SELECT 1 FROM chapters c_has WHERE c_has.manga_id = m.id)
              AND COALESCE(period_totals.period_views, 0) > 0
          )
          SELECT COUNT(*)::bigint AS total
          FROM ranked
        `;

    const pageSql = query.time === "all_time"
      ? `
          WITH chapter_totals AS (
            SELECT
              c.manga_id,
              SUM(GREATEST(COALESCE(v.view_count, 0), 0))::bigint AS chapter_total_views
            FROM chapters c
            LEFT JOIN chapter_view_stats v ON v.chapter_id = c.id
            GROUP BY c.manga_id
          ),
          ranked AS (
            SELECT
              m.id AS manga_id,
              COALESCE(chapter_totals.chapter_total_views, 0)::bigint AS manga_views
            FROM manga m
            LEFT JOIN chapter_totals ON chapter_totals.manga_id = m.id
            WHERE COALESCE(m.is_hidden, 0) = 0
              AND EXISTS (SELECT 1 FROM chapters c_has WHERE c_has.manga_id = m.id)
          )
          SELECT manga_id, manga_views
          FROM ranked
          ORDER BY manga_views DESC, manga_id DESC
          LIMIT $1 OFFSET $2
        `
      : `
          WITH period_totals AS (
            SELECT
              stats.manga_id,
              SUM(GREATEST(COALESCE(stats.view_count, 0), 0))::bigint AS period_views
            FROM manga_view_daily_stats stats
            WHERE stats.view_date >= $1
            GROUP BY stats.manga_id
          ),
          chapter_totals AS (
            SELECT
              c.manga_id,
              SUM(GREATEST(COALESCE(v.view_count, 0), 0))::bigint AS chapter_total_views
            FROM chapters c
            LEFT JOIN chapter_view_stats v ON v.chapter_id = c.id
            GROUP BY c.manga_id
          ),
          ranked AS (
            SELECT
              m.id AS manga_id,
              LEAST(
                COALESCE(period_totals.period_views, 0),
                COALESCE(chapter_totals.chapter_total_views, 0)
              )::bigint AS manga_views
            FROM manga m
            LEFT JOIN period_totals ON period_totals.manga_id = m.id
            LEFT JOIN chapter_totals ON chapter_totals.manga_id = m.id
            WHERE COALESCE(m.is_hidden, 0) = 0
              AND EXISTS (SELECT 1 FROM chapters c_has WHERE c_has.manga_id = m.id)
              AND COALESCE(period_totals.period_views, 0) > 0
          )
          SELECT manga_id, manga_views
          FROM ranked
          ORDER BY manga_views DESC, manga_id DESC
          LIMIT $2 OFFSET $3
        `;

    const totalResult = query.time === "all_time"
      ? await pool.query<{ total: string | number }>(totalSql)
      : await pool.query<{ total: string | number }>(totalSql, [sinceDate]);

    const total = Number(totalResult.rows[0]?.total) || 0;

    if (total === 0) {
      return {
        items: [],
        total: 0,
      };
    }

    const rankingResult = query.time === "all_time"
      ? await pool.query<TopMangaQueryRow>(pageSql, [query.limit, offset])
      : await pool.query<TopMangaQueryRow>(pageSql, [sinceDate, query.limit, offset]);

    const rankedRows = rankingResult.rows;
    const rankedIds = rankedRows
      .map((row) => Number(row.manga_id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .map((id) => Math.floor(id));

    const rankingMetaById = new Map(
      rankedRows.map((row, index) => {
        const mangaId = Math.floor(Number(row.manga_id));

        return [mangaId, {
          rank: offset + index + 1,
          totalViews: Number(row.manga_views) || 0,
        }];
      }),
    );

    const mangaItems = await this.listPublicMangaByIds(rankedIds);
    const mangaById = new Map(mangaItems.map((item) => [item.id, item]));

    return {
      items: rankedIds
        .map((id) => {
          const item = mangaById.get(id);
          const rankingMeta = rankingMetaById.get(id);

          if (!item || !rankingMeta) {
            return null;
          }

          return {
            ...item,
            rank: rankingMeta.rank,
            totalViews: rankingMeta.totalViews,
          } satisfies MangaTopItem;
        })
        .filter((item): item is MangaTopItem => item !== null),
      total,
    };
  }

  async listTopPublicManga(query: MangaTopQuery): Promise<PublicTopMangaListResult> {
    switch (query.sort_by) {
      case "views":
        return this.listTopPublicMangaByViews(query);
    }
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
        description: manga.description,
        author: manga.author,
        status: manga.status,
        cover: manga.cover,
        coverUpdatedAt: manga.coverUpdatedAt,
        updatedAt: manga.updatedAt,
        createdAt: manga.createdAt,
        commentCount: visibleCommentCountExpr,
        totalViews: totalMangaViewsExpr,
        totalFollows: totalMangaFollowsExpr,
        latestChapterNumber: chapterStats.latestChapterNumber,
        chapterCount: sql<number>`coalesce(${chapterStats.chapterCount}, 0)`.mapWith(Number),
        isOneshot: manga.isOneshot,
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
      totalViews: item.totalViews,
      totalFollows: item.totalFollows,
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
        groupName: manga.groupName,
        updatedAt: manga.updatedAt,
        createdAt: manga.createdAt,
        commentCount: visibleCommentCountExpr,
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
      updatedAt: toIsoDateString(item.updatedAt),
      createdAt: toIsoDateString(item.createdAt),
      commentCount: item.commentCount,
      status: normalizeMangaStatus(item.status),
    }));
  }
}

export const mangaRepository = new MangaRepository();
