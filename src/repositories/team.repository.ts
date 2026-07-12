import type { GroupSummary } from "../contracts/manga.js";
import type { TeamListQuery, TeamMangaListQuery, TeamMember, TeamSummary, TeamUpdateItem, TeamUpdatesQuery } from "../contracts/team.js";
import { mangaRepository } from "./manga.repository.js";
import { pool } from "../db/client.js";
import { getPublicChapterAccess } from "../lib/chapter-access.js";
import { publicMangaVisibilitySql } from "../lib/public-manga-visibility.js";
import { buildTeamAvatarUrl, buildTeamCoverUrl, buildUserAvatarUrl, formatNumericText, parseNumericValue, toIsoDateString } from "../lib/public-content.js";

interface TeamRow {
  team_id: number;
  team_name: string;
  team_slug: string;
  team_intro: string;
  team_avatar_url: string | null;
  team_cover_url: string | null;
  team_updated_at?: string | number | null;
}

interface TeamMembersCountRow {
  member_count: string | number;
  leader_count: string | number;
}

interface TeamSeriesStatsRow {
  manga_count: string | number;
  chapter_count: string | number;
}

interface TeamCommentStatsRow {
  comment_count: string | number;
}

interface TeamListCountRow {
  total: string | number;
}

interface TeamMemberRow {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
}

interface TeamUpdateCountRow {
  total: string | number;
}

interface TeamUpdateRow {
  manga_id: number;
  manga_slug: string;
  manga_title: string;
  manga_oneshot_locked: boolean;
  chapter_id: number;
  chapter_number: string | number;
  chapter_title: string | null;
  chapter_date: string | null;
  chapter_pages: number | null;
  chapter_is_oneshot: boolean;
  chapter_interaction_boost_enabled: boolean;
  chapter_group_name: string | null;
  chapter_password_hash: string | null;
}

interface MangaTeamLookupRow {
  manga_id: number;
  team_id: number;
  team_name: string;
}

const buildRoleLabel = (role: string): string => (role.trim().toLowerCase() === "leader" ? "Leader" : "Member");

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : null;
};

const toNonNegativeInt = (value: string | number | null | undefined): number => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

const mapTeamUpdateItem = (row: TeamUpdateRow): TeamUpdateItem => ({
  manga: {
    id: row.manga_id,
    slug: row.manga_slug,
    title: row.manga_title,
  },
  chapter: {
    id: row.chapter_id,
    number: parseNumericValue(row.chapter_number) ?? 0,
    numberText: formatNumericText(row.chapter_number),
    title: normalizeOptionalText(row.chapter_title),
    date: toIsoDateString(row.chapter_date),
    pages: row.chapter_pages,
    access: getPublicChapterAccess({
      chapterPasswordHash: row.chapter_password_hash,
      chapterInteractionBoostEnabled: row.chapter_interaction_boost_enabled,
      chapterIsOneshot: row.chapter_is_oneshot,
      mangaOneshotLocked: row.manga_oneshot_locked,
    }),
    isOneshot: row.chapter_is_oneshot,
    groupName: normalizeOptionalText(row.chapter_group_name),
  },
});

const mapTeamSummary = (
  teamRow: TeamRow,
  options: {
    memberCount: string | number | null | undefined;
    leaderCount: string | number | null | undefined;
    mangaCount: string | number | null | undefined;
    chapterCount: string | number | null | undefined;
    commentCount: string | number | null | undefined;
  },
): TeamSummary => ({
  id: teamRow.team_id,
  slug: teamRow.team_slug,
  name: teamRow.team_name,
  intro: normalizeOptionalText(teamRow.team_intro),
  avatarUrl: buildTeamAvatarUrl(teamRow.team_avatar_url, teamRow.team_updated_at),
  coverUrl: buildTeamCoverUrl(teamRow.team_cover_url, teamRow.team_updated_at),
  memberCount: toNonNegativeInt(options.memberCount),
  leaderCount: toNonNegativeInt(options.leaderCount),
  totalMangaCount: toNonNegativeInt(options.mangaCount),
  totalChapterCount: toNonNegativeInt(options.chapterCount),
  totalCommentCount: toNonNegativeInt(options.commentCount),
});

const buildTeamListSearchClause = (query: TeamListQuery, params: unknown[]): string => {
  const searchTerm = (query.q ?? "").trim();

  if (!searchTerm) {
    return "";
  }

  const searchPattern = `%${searchTerm}%`;
  params.push(searchPattern, searchPattern, searchPattern);

  return `
      AND (
        t.name ILIKE $${params.length - 2}
        OR t.slug ILIKE $${params.length - 1}
        OR t.intro ILIKE $${params.length}
      )`;
};

const buildTeamListOrderClause = (sort: TeamListQuery["sort"]): string => {
  switch (sort) {
    case "member_count":
      return `COALESCE(member_stats.member_count, 0) DESC, lower(t.name) ASC, t.id DESC`;
    case "manga_count":
      return `COALESCE(series_stats.manga_count, 0) DESC, lower(t.name) ASC, t.id DESC`;
    case "chapter_count":
      return `COALESCE(series_stats.chapter_count, 0) DESC, lower(t.name) ASC, t.id DESC`;
    case "comment_count":
      return `COALESCE(series_stats.comment_count, 0) DESC, lower(t.name) ASC, t.id DESC`;
    case "updated_at":
    default:
      return `t.updated_at DESC, lower(t.name) ASC, t.id DESC`;
  }
};

export class TeamRepository {
  async resolvePublicGroupsByMangaIds(mangaIds: number[]): Promise<Map<number, GroupSummary[]>> {
    const uniqueIds = Array.from(new Set(mangaIds.filter((id) => Number.isInteger(id) && id > 0)));

    if (uniqueIds.length === 0) {
      return new Map();
    }

    const { rows } = await pool.query<MangaTeamLookupRow>(
      `
        SELECT
          mtt.manga_id,
          t.id AS team_id,
          t.name AS team_name
        FROM manga_translation_teams mtt
        JOIN translation_teams t ON t.id = mtt.team_id
        WHERE mtt.manga_id = ANY($1::int[])
          AND t.status = 'approved'
        ORDER BY mtt.manga_id ASC, t.id ASC
      `,
      [uniqueIds],
    );

    const groupsByMangaId = new Map(uniqueIds.map((id) => [id, [] as GroupSummary[]]));
    for (const row of rows) {
      groupsByMangaId.get(row.manga_id)?.push({ id: row.team_id, name: row.team_name });
    }

    return groupsByMangaId;
  }

  private async findApprovedTeamRowById(id: number): Promise<TeamRow | null> {
    const { rows: teamRows } = await pool.query<TeamRow>(
      `
        SELECT
          t.id AS team_id,
          t.name AS team_name,
          t.slug AS team_slug,
          t.intro AS team_intro,
          t.avatar_url AS team_avatar_url,
          t.cover_url AS team_cover_url,
          t.updated_at AS team_updated_at
        FROM translation_teams t
        WHERE t.id = $1
          AND t.status = 'approved'
        LIMIT 1
      `,
      [id],
    );

    return teamRows[0] ?? null;
  }

  async listPublicTeams(query: TeamListQuery): Promise<{ items: TeamSummary[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const countParams: unknown[] = [];
    const searchClause = buildTeamListSearchClause(query, countParams);

    const countResult = await pool.query<TeamListCountRow>(
      `
        SELECT COUNT(*) AS total
        FROM translation_teams t
        WHERE t.status = 'approved'
        ${searchClause}
      `,
      countParams,
    );

    const total = toNonNegativeInt(countResult.rows[0]?.total);

    if (total === 0) {
      return {
        items: [],
        total: 0,
      };
    }

    const listParams: unknown[] = [];
    const listSearchClause = buildTeamListSearchClause(query, listParams);
    listParams.push(query.limit, offset);
    const orderClause = buildTeamListOrderClause(query.sort);
    const { rows } = await pool.query<
      TeamRow &
      TeamMembersCountRow &
      TeamSeriesStatsRow &
      TeamCommentStatsRow
    >(
      `
        WITH member_stats AS (
          SELECT
            tm.team_id,
            COUNT(*) AS member_count,
            COUNT(*) FILTER (WHERE lower(trim(tm.role)) = 'leader') AS leader_count
          FROM translation_team_members tm
          WHERE tm.status = 'approved'
          GROUP BY tm.team_id
        ),
        chapter_stats AS (
          SELECT c.manga_id, COUNT(*) AS chapter_count
          FROM chapters c
          GROUP BY c.manga_id
        ),
        comment_stats AS (
          SELECT c.manga_id, COUNT(*) AS comment_count
          FROM comments c
          WHERE c.status = 'visible'
          GROUP BY c.manga_id
        ),
        series_stats AS (
          SELECT
            mtt.team_id,
            COUNT(DISTINCT m.id) AS manga_count,
            COALESCE(SUM(COALESCE(chapter_stats.chapter_count, 0)), 0) AS chapter_count,
            COALESCE(SUM(COALESCE(comment_stats.comment_count, 0)), 0) AS comment_count
          FROM manga_translation_teams mtt
          JOIN manga m ON m.id = mtt.manga_id AND ${publicMangaVisibilitySql("m")}
          LEFT JOIN chapter_stats ON chapter_stats.manga_id = m.id
          LEFT JOIN comment_stats ON comment_stats.manga_id = m.id
          GROUP BY mtt.team_id
        )
        SELECT
          t.id AS team_id,
          t.name AS team_name,
          t.slug AS team_slug,
          t.intro AS team_intro,
          t.avatar_url AS team_avatar_url,
          t.cover_url AS team_cover_url,
          t.updated_at AS team_updated_at,
          COALESCE(member_stats.member_count, 0) AS member_count,
          COALESCE(member_stats.leader_count, 0) AS leader_count,
          COALESCE(series_stats.manga_count, 0) AS manga_count,
          COALESCE(series_stats.chapter_count, 0) AS chapter_count,
          COALESCE(series_stats.comment_count, 0) AS comment_count
        FROM translation_teams t
        LEFT JOIN member_stats ON member_stats.team_id = t.id
        LEFT JOIN series_stats ON series_stats.team_id = t.id
        WHERE t.status = 'approved'
        ${listSearchClause}
        ORDER BY ${orderClause}
        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
      `,
      listParams,
    );

    return {
      items: rows.map((row) =>
        mapTeamSummary(row, {
          memberCount: row.member_count,
          leaderCount: row.leader_count,
          mangaCount: row.manga_count,
          chapterCount: row.chapter_count,
          commentCount: row.comment_count,
        })),
      total,
    };
  }

  async findPublicTeamById(id: number): Promise<TeamSummary | null> {
    const teamRow = await this.findApprovedTeamRowById(id);

    if (!teamRow) {
      return null;
    }

    const [memberCountsResult, seriesStatsResult, commentStatsResult] = await Promise.all([
      pool.query<TeamMembersCountRow>(
        `
          SELECT
            COUNT(*) AS member_count,
            COUNT(*) FILTER (WHERE lower(trim(tm.role)) = 'leader') AS leader_count
          FROM translation_team_members tm
          WHERE tm.team_id = $1
            AND tm.status = 'approved'
        `,
        [id],
      ),
      pool.query<TeamSeriesStatsRow>(
        `
          SELECT
            COUNT(*) AS manga_count,
            COALESCE(SUM(chapter_stats.chapter_count), 0) AS chapter_count
          FROM manga_translation_teams mtt
          JOIN manga m ON m.id = mtt.manga_id
          LEFT JOIN (
            SELECT c.manga_id, COUNT(*) AS chapter_count
            FROM chapters c
            GROUP BY c.manga_id
          ) chapter_stats ON chapter_stats.manga_id = m.id
          WHERE mtt.team_id = $1
            AND ${publicMangaVisibilitySql("m")}
        `,
        [id],
      ),
      pool.query<TeamCommentStatsRow>(
        `
          SELECT COALESCE(SUM(comment_stats.comment_count), 0) AS comment_count
          FROM manga_translation_teams mtt
          JOIN manga m ON m.id = mtt.manga_id
          LEFT JOIN (
            SELECT c.manga_id, COUNT(*) AS comment_count
            FROM comments c
            WHERE c.status = 'visible'
            GROUP BY c.manga_id
          ) comment_stats ON comment_stats.manga_id = m.id
          WHERE mtt.team_id = $1
            AND ${publicMangaVisibilitySql("m")}
        `,
        [id],
      ),
    ]);

    return mapTeamSummary(teamRow, {
      memberCount: memberCountsResult.rows[0]?.member_count,
      leaderCount: memberCountsResult.rows[0]?.leader_count,
      mangaCount: seriesStatsResult.rows[0]?.manga_count,
      chapterCount: seriesStatsResult.rows[0]?.chapter_count,
      commentCount: commentStatsResult.rows[0]?.comment_count,
    });
  }

  async listPublicTeamMembersByTeamId(id: number): Promise<TeamMember[] | null> {
    const team = await this.findApprovedTeamRowById(id);

    if (!team) {
      return null;
    }

    const { rows } = await pool.query<TeamMemberRow>(
      `
        SELECT
          u.username,
          u.display_name,
          u.avatar_url,
          tm.role
        FROM translation_team_members tm
        JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = $1
          AND tm.status = 'approved'
        ORDER BY CASE WHEN lower(trim(tm.role)) = 'leader' THEN 0 ELSE 1 END ASC, lower(u.username) ASC
      `,
      [id],
    );

    return rows.map((row) => ({
      username: row.username,
      displayName: normalizeOptionalText(row.display_name),
      avatarUrl: buildUserAvatarUrl(row.avatar_url),
      role: row.role,
      roleLabel: buildRoleLabel(row.role),
    }));
  }

  async listPublicTeamMangaByTeamId(id: number, query: TeamMangaListQuery) {
    const team = await this.findApprovedTeamRowById(id);

    if (!team) {
      return null;
    }

    return mangaRepository.listPublicMangaByTeamId(id, {
      ...query,
      hasChapters: 0,
    });
  }

  async listPublicTeamUpdatesByTeamId(id: number, query: TeamUpdatesQuery): Promise<{ items: TeamUpdateItem[]; total: number } | null> {
    const team = await this.findApprovedTeamRowById(id);

    if (!team) {
      return null;
    }

    const offset = (query.page - 1) * query.limit;

    const [countResult, rowsResult] = await Promise.all([
      pool.query<TeamUpdateCountRow>(
        `
          SELECT COUNT(*) AS total
          FROM chapters c
          JOIN manga m ON m.id = c.manga_id
          JOIN manga_translation_teams mtt ON mtt.manga_id = m.id
          WHERE ${publicMangaVisibilitySql("m")}
            AND lower(COALESCE(c.processing_state, '')) <> 'processing'
            AND mtt.team_id = $1
        `,
        [id],
      ),
      pool.query<TeamUpdateRow>(
        `
          SELECT
            m.id AS manga_id,
            m.slug AS manga_slug,
            m.title AS manga_title,
            COALESCE(m.oneshot_locked, false) AS manga_oneshot_locked,
            c.id AS chapter_id,
            c.number AS chapter_number,
            c.title AS chapter_title,
            c.date AS chapter_date,
            c.pages AS chapter_pages,
            COALESCE(c.is_oneshot, false) AS chapter_is_oneshot,
            COALESCE(c.interaction_boost_enabled, false) AS chapter_interaction_boost_enabled,
            c.group_name AS chapter_group_name,
            c.password_hash AS chapter_password_hash
          FROM chapters c
          JOIN manga m ON m.id = c.manga_id
          JOIN manga_translation_teams mtt ON mtt.manga_id = m.id
          WHERE ${publicMangaVisibilitySql("m")}
            AND lower(COALESCE(c.processing_state, '')) <> 'processing'
            AND mtt.team_id = $1
          ORDER BY c.id DESC
          LIMIT $2
          OFFSET $3
        `,
        [id, query.limit, offset],
      ),
    ]);

    return {
      items: rowsResult.rows.map(mapTeamUpdateItem),
      total: toNonNegativeInt(countResult.rows[0]?.total),
    };
  }
}

export const teamRepository = new TeamRepository();
