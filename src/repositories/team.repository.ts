import type { TeamMangaListQuery, TeamMember, TeamSummary, TeamUpdateItem, TeamUpdatesQuery } from "../contracts/team.js";
import { env } from "../config/env.js";
import { mangaRepository } from "./manga.repository.js";
import { pool } from "../db/client.js";
import { getPublicChapterAccess } from "../lib/chapter-access.js";
import { formatNumericText, parseNumericValue, toIsoDateString } from "../lib/public-content.js";

interface TeamRow {
  team_id: number;
  team_name: string;
  team_slug: string;
  team_intro: string;
  team_avatar_url: string | null;
  team_cover_url: string | null;
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
  chapter_group_name: string | null;
  chapter_password_hash: string | null;
}

const buildRoleLabel = (role: string): string => (role.trim().toLowerCase() === "leader" ? "Leader" : "Member");

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : null;
};

const normalizeOptionalUrl = (value: string | null | undefined): string | null => {
  const text = normalizeOptionalText(value);

  if (!text) {
    return null;
  }

  try {
    const url = new URL(text, env.PUBLIC_SITE_URL);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
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
      chapterIsOneshot: row.chapter_is_oneshot,
      mangaOneshotLocked: row.manga_oneshot_locked,
    }),
    isOneshot: row.chapter_is_oneshot,
    groupName: normalizeOptionalText(row.chapter_group_name),
  },
});

const buildTeamGroupNameListExpr = (columnSql: string) =>
  `replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(trim(COALESCE(${columnSql}, ''))), ' / ', ','), '/', ','), ' & ', ','), '&', ','), ' + ', ','), '+', ','), ';', ','), '|', ','), ', ', ','), ' ,', ',')`;

const buildTeamGroupNameMatchSql = (columnSql: string) => {
  const normalizedList = buildTeamGroupNameListExpr(columnSql);

  return `
    (
      lower(trim(COALESCE(${columnSql}, ''))) = lower(trim($1))
      OR (',' || ${normalizedList} || ',') LIKE ('%,' || lower(trim($2)) || ',%')
      OR lower(COALESCE(${columnSql}, '')) LIKE ('%' || lower(trim($3)) || '%')
    )
  `;
};

const buildEffectiveChapterGroupSql = () => `COALESCE(NULLIF(c.group_name, ''), m.group_name)`;

export class TeamRepository {
  private async findApprovedTeamRowById(id: number): Promise<TeamRow | null> {
    const { rows: teamRows } = await pool.query<TeamRow>(
      `
        SELECT
          t.id AS team_id,
          t.name AS team_name,
          t.slug AS team_slug,
          t.intro AS team_intro,
          t.avatar_url AS team_avatar_url,
          t.cover_url AS team_cover_url
        FROM translation_teams t
        WHERE t.id = $1
          AND t.status = 'approved'
        LIMIT 1
      `,
      [id],
    );

    return teamRows[0] ?? null;
  }

  async findPublicTeamById(id: number): Promise<TeamSummary | null> {
    const teamRow = await this.findApprovedTeamRowById(id);

    if (!teamRow) {
      return null;
    }

    const safeTeamName = teamRow.team_name.trim();

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
      safeTeamName
        ? pool.query<TeamSeriesStatsRow>(
            `
              SELECT
                COUNT(*) AS manga_count,
                COALESCE(SUM(chapter_stats.chapter_count), 0) AS chapter_count
              FROM manga m
              LEFT JOIN (
                SELECT c.manga_id, COUNT(*) AS chapter_count
                FROM chapters c
                GROUP BY c.manga_id
              ) chapter_stats ON chapter_stats.manga_id = m.id
              WHERE COALESCE(m.is_hidden, 0) = 0
                AND ${buildTeamGroupNameMatchSql("m.group_name")}
            `,
            [safeTeamName, safeTeamName, safeTeamName],
          )
        : Promise.resolve({ rows: [{ manga_count: 0, chapter_count: 0 }] }),
      safeTeamName
        ? pool.query<TeamCommentStatsRow>(
            `
              SELECT COALESCE(SUM(comment_stats.comment_count), 0) AS comment_count
              FROM manga m
              LEFT JOIN (
                SELECT c.manga_id, COUNT(*) AS comment_count
                FROM comments c
                WHERE c.status = 'visible'
                GROUP BY c.manga_id
              ) comment_stats ON comment_stats.manga_id = m.id
              WHERE COALESCE(m.is_hidden, 0) = 0
                AND ${buildTeamGroupNameMatchSql("m.group_name")}
            `,
            [safeTeamName, safeTeamName, safeTeamName],
          )
        : Promise.resolve({ rows: [{ comment_count: 0 }] }),
    ]);

    return {
      id: teamRow.team_id,
      slug: teamRow.team_slug,
      name: teamRow.team_name,
      intro: normalizeOptionalText(teamRow.team_intro),
      avatarUrl: normalizeOptionalUrl(teamRow.team_avatar_url),
      coverUrl: normalizeOptionalUrl(teamRow.team_cover_url),
      memberCount: toNonNegativeInt(memberCountsResult.rows[0]?.member_count),
      leaderCount: toNonNegativeInt(memberCountsResult.rows[0]?.leader_count),
      totalMangaCount: toNonNegativeInt(seriesStatsResult.rows[0]?.manga_count),
      totalChapterCount: toNonNegativeInt(seriesStatsResult.rows[0]?.chapter_count),
      totalCommentCount: toNonNegativeInt(commentStatsResult.rows[0]?.comment_count),
    };
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
      avatarUrl: normalizeOptionalUrl(row.avatar_url),
      role: row.role,
      roleLabel: buildRoleLabel(row.role),
    }));
  }

  async listPublicTeamMangaByTeamId(id: number, query: TeamMangaListQuery) {
    const team = await this.findApprovedTeamRowById(id);

    if (!team) {
      return null;
    }

    return mangaRepository.listPublicMangaByGroupName(team.team_name, query);
  }

  async listPublicTeamUpdatesByTeamId(id: number, query: TeamUpdatesQuery): Promise<{ items: TeamUpdateItem[]; total: number } | null> {
    const team = await this.findApprovedTeamRowById(id);

    if (!team) {
      return null;
    }

    const safeTeamName = team.team_name.trim();

    if (!safeTeamName) {
      return {
        items: [],
        total: 0,
      };
    }

    const offset = (query.page - 1) * query.limit;
    const effectiveGroupSql = buildEffectiveChapterGroupSql();

    const [countResult, rowsResult] = await Promise.all([
      pool.query<TeamUpdateCountRow>(
        `
          SELECT COUNT(*) AS total
          FROM chapters c
          JOIN manga m ON m.id = c.manga_id
          WHERE COALESCE(m.is_hidden, 0) = 0
            AND ${buildTeamGroupNameMatchSql(effectiveGroupSql)}
        `,
        [safeTeamName, safeTeamName, safeTeamName],
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
            c.group_name AS chapter_group_name,
            c.password_hash AS chapter_password_hash
          FROM chapters c
          JOIN manga m ON m.id = c.manga_id
          WHERE COALESCE(m.is_hidden, 0) = 0
            AND ${buildTeamGroupNameMatchSql(effectiveGroupSql)}
          ORDER BY c.id DESC
          LIMIT $4
          OFFSET $5
        `,
        [safeTeamName, safeTeamName, safeTeamName, query.limit, offset],
      ),
    ]);

    return {
      items: rowsResult.rows.map(mapTeamUpdateItem),
      total: toNonNegativeInt(countResult.rows[0]?.total),
    };
  }
}

export const teamRepository = new TeamRepository();
