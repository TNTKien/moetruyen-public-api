import type { CommentAuthor, CommentListQuery, CommentReplyItem, CommentThreadItem, RecentCommentItem } from "../contracts/comment.js";
import { env } from "../config/env.js";
import { pool } from "../db/client.js";
import { getPublicChapterAccess, type PublicChapterAccess } from "../lib/chapter-access.js";
import { formatNumericText, parseNumericValue, toIsoDateString } from "../lib/public-content.js";

interface CommentAuthorFields {
  author_name: string | null;
  author_user_id: string | null;
  author_username: string | null;
  author_avatar_url: string | null;
}

interface RecentCommentRow extends CommentAuthorFields {
  id: number;
  content: string | null;
  created_at: string | number | null;
  comment_page: string | number | null;
  manga_id: number;
  manga_slug: string;
  manga_title: string;
  manga_oneshot_locked: boolean;
  chapter_id: number | null;
  chapter_number: string | number | null;
  chapter_password_hash: string | null;
  chapter_is_oneshot: boolean | null;
}

interface CommentThreadCountRow {
  total: string | number;
}

interface CommentThreadRow extends CommentAuthorFields {
  id: number;
  content: string | null;
  created_at: string | number | null;
  parent_id: number | null;
}

interface ChapterCommentLookupRow {
  manga_id: number;
  manga_is_hidden: number;
  manga_oneshot_locked: boolean;
  chapter_id: number;
  chapter_number: string | number;
  chapter_password_hash: string | null;
  chapter_is_oneshot: boolean;
}

export type ChapterCommentsLookupResult =
  | { kind: "not_found" }
  | { kind: "forbidden"; reason: Exclude<PublicChapterAccess, "public"> };

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

const mapCommentAuthor = (row: CommentAuthorFields): CommentAuthor => ({
  name: normalizeOptionalText(row.author_name) ?? "Thành viên",
  username: normalizeOptionalText(row.author_username),
  userId: normalizeOptionalText(row.author_user_id),
  avatarUrl: normalizeOptionalUrl(row.author_avatar_url),
});

const buildMangaCommentPath = (mangaSlug: string, commentId: number): string =>
  `/manga/${encodeURIComponent(mangaSlug)}#comment-${encodeURIComponent(String(commentId))}`;

const buildChapterCommentPath = (mangaSlug: string, chapterNumber: string, commentId: number, commentPage = 1): string => {
  const basePath = `/manga/${encodeURIComponent(mangaSlug)}/chapters/${encodeURIComponent(chapterNumber)}`;
  const commentPageQuery = commentPage > 1 ? `?commentPage=${encodeURIComponent(String(commentPage))}` : "";
  return `${basePath}${commentPageQuery}#comment-${encodeURIComponent(String(commentId))}`;
};

const buildCommentOrderSql = (order: CommentListQuery["order"]): string =>
  order === "asc" ? "c.created_at ASC, c.id ASC" : "c.created_at DESC, c.id DESC";

const buildReplyOrderSql = (order: CommentListQuery["order"]): string =>
  order === "asc" ? "reply.created_at ASC, reply.id ASC" : "reply.created_at DESC, reply.id DESC";

const buildReplyItem = (row: CommentThreadRow, commentPath: string): CommentReplyItem => ({
  id: row.id,
  content: normalizePlainText(row.content),
  createdAt: toIsoDateString(row.created_at),
  commentPath,
  author: mapCommentAuthor(row),
});

export class CommentRepository {
  async listRecentPublicComments(query: CommentListQuery): Promise<{ items: RecentCommentItem[]; total: number }> {
    const offset = (query.page - 1) * query.limit;
    const orderSql = buildCommentOrderSql(query.order);

    const [countResult, rowsResult] = await Promise.all([
      pool.query<CommentThreadCountRow>(
        `
          SELECT COUNT(*) AS total
          FROM comments c
          JOIN manga m ON m.id = c.manga_id
          WHERE c.status = 'visible'
            AND c.parent_id IS NULL
            AND COALESCE(c.client_request_id, '') NOT ILIKE 'forum-%'
            AND COALESCE(m.is_hidden, 0) = 0
        `,
      ),
      pool.query<RecentCommentRow>(
        `
          SELECT
            c.id,
            c.content,
            c.created_at,
            (
              FLOOR(
                COUNT(*) FILTER (
                  WHERE c_scope.id > c.id
                )::numeric / 20
              )::int + 1
            ) AS comment_page,
            m.id AS manga_id,
            m.slug AS manga_slug,
            m.title AS manga_title,
            COALESCE(m.oneshot_locked, false) AS manga_oneshot_locked,
            ch.id AS chapter_id,
            c.chapter_number,
            ch.password_hash AS chapter_password_hash,
            COALESCE(ch.is_oneshot, false) AS chapter_is_oneshot,
            c.author AS author_name,
            c.author_user_id,
            COALESCE(u.username, '') AS author_username,
            c.author_avatar_url
          FROM comments c
          JOIN manga m ON m.id = c.manga_id
          LEFT JOIN chapters ch ON ch.manga_id = c.manga_id AND ch.number = c.chapter_number
          LEFT JOIN comments c_scope
            ON c_scope.status = 'visible'
            AND c_scope.parent_id IS NULL
            AND COALESCE(c_scope.client_request_id, '') NOT ILIKE 'forum-%'
            AND c_scope.manga_id = c.manga_id
            AND (
              (c.chapter_number IS NULL AND c_scope.chapter_number IS NULL)
              OR (c.chapter_number IS NOT NULL AND c_scope.chapter_number = c.chapter_number)
            )
          LEFT JOIN users u ON NULLIF(trim(COALESCE(c.author_user_id, '')), '') IS NOT NULL
            AND u.id::text = trim(COALESCE(c.author_user_id, ''))
          WHERE c.status = 'visible'
            AND c.parent_id IS NULL
            AND COALESCE(c.client_request_id, '') NOT ILIKE 'forum-%'
            AND COALESCE(m.is_hidden, 0) = 0
          GROUP BY
            c.id,
            c.content,
            c.created_at,
            m.id,
            m.slug,
            m.title,
            m.oneshot_locked,
            ch.id,
            c.chapter_number,
            ch.password_hash,
            ch.is_oneshot,
            c.author,
            c.author_user_id,
            u.username,
            c.author_avatar_url
          ORDER BY ${orderSql}
          LIMIT $1
          OFFSET $2
        `,
        [query.limit, offset],
      ),
    ]);

    return {
      items: rowsResult.rows.map((row) => {
        const chapterNumberText = formatNumericText(row.chapter_number);
        const chapterAccess = row.chapter_id
          ? getPublicChapterAccess({
              chapterPasswordHash: row.chapter_password_hash,
              chapterIsOneshot: Boolean(row.chapter_is_oneshot),
              mangaOneshotLocked: row.manga_oneshot_locked,
            })
          : null;

        return {
          id: row.id,
          content: normalizePlainText(row.content),
          contentPreview: buildPreviewText(row.content),
          createdAt: toIsoDateString(row.created_at),
          commentPage: Math.max(1, toNonNegativeInt(row.comment_page) || 1),
          commentPath: row.chapter_id && chapterNumberText
            ? buildChapterCommentPath(row.manga_slug, chapterNumberText, row.id, Math.max(1, toNonNegativeInt(row.comment_page) || 1))
            : buildMangaCommentPath(row.manga_slug, row.id),
          author: mapCommentAuthor(row),
          manga: {
            id: row.manga_id,
            slug: row.manga_slug,
            title: row.manga_title,
          },
          chapter: row.chapter_id
            ? {
                id: row.chapter_id,
                number: parseNumericValue(row.chapter_number) ?? 0,
                numberText: chapterNumberText,
                access: chapterAccess ?? "public",
              }
            : null,
        };
      }),
      total: toNonNegativeInt(countResult.rows[0]?.total),
    };
  }

  async listPublicMangaCommentsByMangaId(mangaId: number, query: CommentListQuery): Promise<{ items: CommentThreadItem[]; total: number } | null> {
    const { rows: mangaRows } = await pool.query<{ manga_id: number; manga_slug: string }>(
      `
        SELECT id AS manga_id, slug AS manga_slug
        FROM manga
        WHERE id = $1
          AND COALESCE(is_hidden, 0) = 0
        LIMIT 1
      `,
      [mangaId],
    );

    const mangaRow = mangaRows[0];

    if (!mangaRow) {
      return null;
    }

    const offset = (query.page - 1) * query.limit;
    const orderSql = buildCommentOrderSql(query.order);
    const replyOrderSql = buildReplyOrderSql(query.order);

    const [countResult, rootRowsResult, replyRowsResult] = await Promise.all([
      pool.query<CommentThreadCountRow>(
        `
          SELECT COUNT(*) AS total
          FROM comments c
          WHERE c.manga_id = $1
            AND c.chapter_number IS NULL
            AND c.status = 'visible'
            AND c.parent_id IS NULL
            AND COALESCE(c.client_request_id, '') NOT ILIKE 'forum-%'
        `,
        [mangaId],
      ),
      pool.query<CommentThreadRow>(
        `
          SELECT
            c.id,
            c.content,
            c.created_at,
            c.parent_id,
            c.author AS author_name,
            c.author_user_id,
            COALESCE(u.username, '') AS author_username,
            c.author_avatar_url
          FROM comments c
          LEFT JOIN users u ON NULLIF(trim(COALESCE(c.author_user_id, '')), '') IS NOT NULL
            AND u.id::text = trim(COALESCE(c.author_user_id, ''))
          WHERE c.manga_id = $1
            AND c.chapter_number IS NULL
            AND c.status = 'visible'
            AND c.parent_id IS NULL
            AND COALESCE(c.client_request_id, '') NOT ILIKE 'forum-%'
          ORDER BY ${orderSql}
          LIMIT $2
          OFFSET $3
        `,
        [mangaId, query.limit, offset],
      ),
      pool.query<CommentThreadRow>(
        `
          SELECT
            reply.id,
            reply.content,
            reply.created_at,
            reply.parent_id,
            reply.author AS author_name,
            reply.author_user_id,
            COALESCE(u.username, '') AS author_username,
            reply.author_avatar_url
          FROM comments reply
          LEFT JOIN users u ON NULLIF(trim(COALESCE(reply.author_user_id, '')), '') IS NOT NULL
            AND u.id::text = trim(COALESCE(reply.author_user_id, ''))
          WHERE reply.manga_id = $1
            AND reply.chapter_number IS NULL
            AND reply.status = 'visible'
            AND reply.parent_id IS NOT NULL
            AND COALESCE(reply.client_request_id, '') NOT ILIKE 'forum-%'
          ORDER BY ${replyOrderSql}
        `,
        [mangaId],
      ),
    ]);

    const repliesByParentId = new Map<number, CommentReplyItem[]>();

    for (const replyRow of replyRowsResult.rows) {
      const parentId = toNonNegativeInt(replyRow.parent_id);

      if (parentId <= 0) {
        continue;
      }

      const items = repliesByParentId.get(parentId) ?? [];
      items.push(buildReplyItem(replyRow, buildMangaCommentPath(mangaRow.manga_slug, replyRow.id)));
      repliesByParentId.set(parentId, items);
    }

    return {
      items: rootRowsResult.rows.map((row) => ({
        id: row.id,
        content: normalizePlainText(row.content),
        createdAt: toIsoDateString(row.created_at),
        commentPath: buildMangaCommentPath(mangaRow.manga_slug, row.id),
        author: mapCommentAuthor(row),
        replies: repliesByParentId.get(row.id) ?? [],
      })),
      total: toNonNegativeInt(countResult.rows[0]?.total),
    };
  }

  async listPublicChapterCommentsByChapterId(chapterId: number, query: CommentListQuery): Promise<{ items: CommentThreadItem[]; total: number } | ChapterCommentsLookupResult> {
    const { rows } = await pool.query<ChapterCommentLookupRow>(
      `
        SELECT
          m.id AS manga_id,
          m.is_hidden AS manga_is_hidden,
          COALESCE(m.oneshot_locked, false) AS manga_oneshot_locked,
          c.id AS chapter_id,
          c.number AS chapter_number,
          c.password_hash AS chapter_password_hash,
          COALESCE(c.is_oneshot, false) AS chapter_is_oneshot
        FROM chapters c
        JOIN manga m ON m.id = c.manga_id
        WHERE c.id = $1
          AND COALESCE(m.is_hidden, 0) = 0
        LIMIT 1
      `,
      [chapterId],
    );

    const chapterRow = rows[0];

    if (!chapterRow) {
      return { kind: "not_found" };
    }

    const chapterAccess = getPublicChapterAccess({
      chapterPasswordHash: chapterRow.chapter_password_hash,
      chapterIsOneshot: chapterRow.chapter_is_oneshot,
      mangaOneshotLocked: chapterRow.manga_oneshot_locked,
    });

    if (chapterAccess !== "public") {
      return {
        kind: "forbidden",
        reason: chapterAccess,
      };
    }

    const chapterNumberText = formatNumericText(chapterRow.chapter_number);

    const safeChapterNumberText = chapterNumberText ?? String(chapterRow.chapter_number);

    const { rows: mangaRows } = await pool.query<{ manga_slug: string }>(
      `SELECT slug AS manga_slug FROM manga WHERE id = $1 LIMIT 1`,
      [chapterRow.manga_id],
    );
    const mangaSlug = mangaRows[0]?.manga_slug ?? "";
    const offset = (query.page - 1) * query.limit;
    const orderSql = buildCommentOrderSql(query.order);
    const replyOrderSql = buildReplyOrderSql(query.order);

    const [countResult, rootRowsResult, replyRowsResult] = await Promise.all([
      pool.query<CommentThreadCountRow>(
        `
          SELECT COUNT(*) AS total
          FROM comments c
          WHERE c.manga_id = $1
            AND c.chapter_number = $2
            AND c.status = 'visible'
            AND c.parent_id IS NULL
            AND COALESCE(c.client_request_id, '') NOT ILIKE 'forum-%'
        `,
        [chapterRow.manga_id, chapterRow.chapter_number],
      ),
      pool.query<CommentThreadRow>(
        `
          SELECT
            c.id,
            c.content,
            c.created_at,
            c.parent_id,
            c.author AS author_name,
            c.author_user_id,
            COALESCE(u.username, '') AS author_username,
            c.author_avatar_url
          FROM comments c
          LEFT JOIN users u ON NULLIF(trim(COALESCE(c.author_user_id, '')), '') IS NOT NULL
            AND u.id::text = trim(COALESCE(c.author_user_id, ''))
          WHERE c.manga_id = $1
            AND c.chapter_number = $2
            AND c.status = 'visible'
            AND c.parent_id IS NULL
            AND COALESCE(c.client_request_id, '') NOT ILIKE 'forum-%'
          ORDER BY ${orderSql}
          LIMIT $3
          OFFSET $4
        `,
        [chapterRow.manga_id, chapterRow.chapter_number, query.limit, offset],
      ),
      pool.query<CommentThreadRow>(
        `
          SELECT
            reply.id,
            reply.content,
            reply.created_at,
            reply.parent_id,
            reply.author AS author_name,
            reply.author_user_id,
            COALESCE(u.username, '') AS author_username,
            reply.author_avatar_url
          FROM comments reply
          LEFT JOIN users u ON NULLIF(trim(COALESCE(reply.author_user_id, '')), '') IS NOT NULL
            AND u.id::text = trim(COALESCE(reply.author_user_id, ''))
          WHERE reply.manga_id = $1
            AND reply.chapter_number = $2
            AND reply.status = 'visible'
            AND reply.parent_id IS NOT NULL
            AND COALESCE(reply.client_request_id, '') NOT ILIKE 'forum-%'
          ORDER BY ${replyOrderSql}
        `,
        [chapterRow.manga_id, chapterRow.chapter_number],
      ),
    ]);

    const repliesByParentId = new Map<number, CommentReplyItem[]>();

    for (const replyRow of replyRowsResult.rows) {
      const parentId = toNonNegativeInt(replyRow.parent_id);

      if (parentId <= 0) {
        continue;
      }

      const items = repliesByParentId.get(parentId) ?? [];
      items.push(buildReplyItem(replyRow, buildChapterCommentPath(mangaSlug, safeChapterNumberText, replyRow.id)));
      repliesByParentId.set(parentId, items);
    }

    return {
      items: rootRowsResult.rows.map((row) => ({
        id: row.id,
        content: normalizePlainText(row.content),
        createdAt: toIsoDateString(row.created_at),
        commentPath: buildChapterCommentPath(mangaSlug, safeChapterNumberText, row.id),
        author: mapCommentAuthor(row),
        replies: repliesByParentId.get(row.id) ?? [],
      })),
      total: toNonNegativeInt(countResult.rows[0]?.total),
    };
  }
}

export const commentRepository = new CommentRepository();
