import type { UserCommentItem, UserCommentsQuery, UserSummary } from "../contracts/user.js";
import { pool } from "../db/client.js";
import { buildUserAvatarUrl, formatNumericText, toIsoDateString } from "../lib/public-content.js";

interface UserProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string | number;
}

interface UserTeamMembershipRow {
  team_id: number;
  role: string;
  team_name: string;
  team_slug: string;
}

interface UserCommentCountRow {
  count: string | number;
}

interface UserPublicCommentRow {
  id: number;
  content: string | null;
  chapter_number: string | number | null;
  parent_id: number | null;
  created_at: string | number | null;
  is_forum_comment: boolean;
  manga_slug: string | null;
  content_title: string | null;
  chapter_title: string | null;
  chapter_is_oneshot: boolean;
  parent_parent_id: number | null;
  forum_root_id: number | null;
  forum_root_content: string | null;
}

export interface PublicUserCommentsResult {
  items: UserCommentItem[];
  total: number;
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

const decodeBasicHtmlEntities = (value: string): string => {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
};

const stripHtmlTags = (value: string): string => value.replace(/<[^>]+>/g, " ");

const normalizePlainText = (value: string | null | undefined): string => {
  return decodeBasicHtmlEntities(stripHtmlTags(String(value ?? ""))).replace(/\s+/g, " ").trim();
};

const buildPreviewText = (value: string | null | undefined, maxLength = 220): string => {
  const normalized = normalizePlainText(value);

  if (!normalized) {
    return "(Empty comment)";
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3).trimEnd()}...` : normalized;
};

const buildForumPostTitle = (value: string | null | undefined): string => {
  const normalized = normalizePlainText(value);

  if (!normalized) {
    return "Forum post";
  }

  return normalized.length > 84 ? `${normalized.slice(0, 81).trimEnd()}...` : normalized;
};

const buildMangaCommentContextLabel = (row: UserPublicCommentRow): string => {
  if (row.chapter_is_oneshot) {
    const chapterTitle = normalizeOptionalText(row.chapter_title);
    return chapterTitle ? `Oneshot - ${chapterTitle}` : "Oneshot";
  }

  const chapterNumberText = formatNumericText(row.chapter_number);
  const chapterTitle = normalizeOptionalText(row.chapter_title);

  if (chapterNumberText && chapterTitle) {
    return `Chapter ${chapterNumberText} - ${chapterTitle}`;
  }

  if (chapterNumberText) {
    return `Chapter ${chapterNumberText}`;
  }

  return "Manga comment";
};

const buildCommentPath = (row: UserPublicCommentRow): string => {
  const commentId = toNonNegativeInt(row.id);

  if (row.is_forum_comment) {
    const parentId = toNonNegativeInt(row.parent_id);
    const parentParentId = toNonNegativeInt(row.parent_parent_id);
    const forumRootId = toNonNegativeInt(row.forum_root_id);
    const forumPostId = forumRootId || parentParentId || parentId;

    return forumPostId > 0 && commentId > 0
      ? `/forum/post/${encodeURIComponent(String(forumPostId))}#comment-${encodeURIComponent(String(commentId))}`
      : "/forum";
  }

  const mangaSlug = normalizeOptionalText(row.manga_slug);
  const chapterNumberText = formatNumericText(row.chapter_number);

  if (!mangaSlug || commentId <= 0) {
    return mangaSlug ? `/manga/${encodeURIComponent(mangaSlug)}` : "/manga";
  }

  if (chapterNumberText) {
    return `/manga/${encodeURIComponent(mangaSlug)}/chapters/${encodeURIComponent(chapterNumberText)}#comment-${encodeURIComponent(String(commentId))}`;
  }

  return `/manga/${encodeURIComponent(mangaSlug)}#comment-${encodeURIComponent(String(commentId))}`;
};

const mapPublicUserComment = (row: UserPublicCommentRow): UserCommentItem => {
  const isForumComment = Boolean(row.is_forum_comment);

  return {
    id: toNonNegativeInt(row.id),
    kind: isForumComment ? "forum_reply" : "manga_comment",
    targetTitle: isForumComment
      ? buildForumPostTitle(row.forum_root_content)
      : normalizeOptionalText(row.content_title) ?? "Manga",
    contextLabel: isForumComment ? "Forum reply" : buildMangaCommentContextLabel(row),
    contentPreview: buildPreviewText(row.content),
    commentPath: buildCommentPath(row),
    createdAt: toIsoDateString(row.created_at),
  };
};

export class UserRepository {
  private async findPublicUserRowByUsername(username: string): Promise<UserProfileRow | null> {
    const { rows } = await pool.query<UserProfileRow>(
      `
        SELECT id, username, display_name, avatar_url, bio, created_at
        FROM users
        WHERE lower(username) = lower($1)
        LIMIT 1
      `,
      [username],
    );

    return rows[0] ?? null;
  }

  private async findApprovedTeamMembershipByUserId(userId: string): Promise<UserTeamMembershipRow | null> {
    const { rows } = await pool.query<UserTeamMembershipRow>(
      `
        SELECT
          tm.team_id,
          tm.role,
          t.name AS team_name,
          t.slug AS team_slug
        FROM translation_team_members tm
        JOIN translation_teams t ON t.id = tm.team_id
        WHERE tm.user_id = $1
          AND tm.status = 'approved'
          AND t.status = 'approved'
        ORDER BY CASE WHEN lower(trim(tm.role)) = 'leader' THEN 0 ELSE 1 END ASC, tm.reviewed_at DESC, tm.requested_at DESC
        LIMIT 1
      `,
      [userId],
    );

    return rows[0] ?? null;
  }

  private async countPublicUserCommentsByUserId(userId: string): Promise<number> {
    const { rows } = await pool.query<UserCommentCountRow>(
      `
        SELECT COUNT(*) AS count
        FROM (
          SELECT c.id
          FROM comments c
          JOIN manga m ON m.id = c.manga_id
          WHERE c.author_user_id = $1
            AND c.status = 'visible'
            AND COALESCE(m.is_hidden, 0) = 0

          UNION ALL

          SELECT fp.id
          FROM forum_posts fp
          WHERE fp.author_user_id = $2
            AND fp.status = 'visible'
            AND COALESCE(fp.parent_id, 0) > 0
        ) profile_comments
      `,
      [userId, userId],
    );

    return toNonNegativeInt(rows[0]?.count);
  }

  async findPublicUserByUsername(username: string): Promise<UserSummary | null> {
    const userRow = await this.findPublicUserRowByUsername(username);

    if (!userRow) {
      return null;
    }

    const [membershipRow, commentCount] = await Promise.all([
      this.findApprovedTeamMembershipByUserId(userRow.id),
      this.countPublicUserCommentsByUserId(userRow.id),
    ]);

    return {
      username: userRow.username,
      displayName: normalizeOptionalText(userRow.display_name),
      avatarUrl: buildUserAvatarUrl(userRow.avatar_url),
      bio: normalizeOptionalText(userRow.bio),
      joinedAt: toIsoDateString(userRow.created_at),
      commentCount,
      team: membershipRow
        ? {
            id: membershipRow.team_id,
            slug: membershipRow.team_slug,
            name: membershipRow.team_name,
            role: membershipRow.role,
            roleLabel: buildRoleLabel(membershipRow.role),
          }
        : null,
    };
  }

  async listPublicUserCommentsByUsername(
    username: string,
    query: UserCommentsQuery,
  ): Promise<PublicUserCommentsResult | null> {
    const userRow = await this.findPublicUserRowByUsername(username);

    if (!userRow) {
      return null;
    }

    const offset = (query.page - 1) * query.limit;
    const total = await this.countPublicUserCommentsByUserId(userRow.id);

    const { rows } = await pool.query<UserPublicCommentRow>(
      `
        SELECT *
        FROM (
          SELECT
            c.id,
            c.content,
            c.chapter_number,
            c.parent_id,
            c.created_at,
            false AS is_forum_comment,
            m.slug AS manga_slug,
            COALESCE(m.title, '') AS content_title,
            COALESCE(ch.title, '') AS chapter_title,
            COALESCE(ch.is_oneshot, false) AS chapter_is_oneshot,
            NULL::integer AS parent_parent_id,
            0 AS forum_root_id,
            '' AS forum_root_content
          FROM comments c
          JOIN manga m ON m.id = c.manga_id
          LEFT JOIN chapters ch ON ch.manga_id = c.manga_id AND ch.number = c.chapter_number
          WHERE c.author_user_id = $1
            AND c.status = 'visible'
            AND COALESCE(m.is_hidden, 0) = 0

          UNION ALL

          SELECT
            fp.id,
            fp.content,
            NULL AS chapter_number,
            fp.parent_id,
            fp.created_at,
            true AS is_forum_comment,
            '' AS manga_slug,
            '' AS content_title,
            '' AS chapter_title,
            false AS chapter_is_oneshot,
            parent_comment.parent_id AS parent_parent_id,
            COALESCE(root_comment.id, 0) AS forum_root_id,
            COALESCE(root_comment.content, '') AS forum_root_content
          FROM forum_posts fp
          LEFT JOIN forum_posts parent_comment ON parent_comment.id = fp.parent_id
          LEFT JOIN forum_posts root_comment ON root_comment.id = (
            CASE
              WHEN fp.parent_id IS NULL THEN fp.id
              WHEN parent_comment.parent_id IS NULL THEN fp.parent_id
              ELSE parent_comment.parent_id
            END
          )
          WHERE fp.author_user_id = $2
            AND fp.status = 'visible'
            AND COALESCE(fp.parent_id, 0) > 0
        ) recent
        ORDER BY recent.created_at DESC, recent.id DESC
        LIMIT $3
        OFFSET $4
      `,
      [userRow.id, userRow.id, query.limit, offset],
    );

    return {
      items: rows.map(mapPublicUserComment),
      total,
    };
  }
}

export const userRepository = new UserRepository();
