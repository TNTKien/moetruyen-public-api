import type { UserSummary } from "../contracts/user.js";
import { env } from "../config/env.js";
import { pool } from "../db/client.js";
import { toIsoDateString } from "../lib/public-content.js";

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

export class UserRepository {
  async findPublicUserByUsername(username: string): Promise<UserSummary | null> {
    const { rows: userRows } = await pool.query<UserProfileRow>(
      `
        SELECT id, username, display_name, avatar_url, bio, created_at
        FROM users
        WHERE lower(username) = lower($1)
        LIMIT 1
      `,
      [username],
    );

    const userRow = userRows[0];

    if (!userRow) {
      return null;
    }

    const [membershipResult, commentCountResult] = await Promise.all([
      pool.query<UserTeamMembershipRow>(
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
        [userRow.id],
      ),
      pool.query<UserCommentCountRow>(
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
        [userRow.id, userRow.id],
      ),
    ]);

    const membershipRow = membershipResult.rows[0];

    return {
      username: userRow.username,
      displayName: normalizeOptionalText(userRow.display_name),
      avatarUrl: normalizeOptionalUrl(userRow.avatar_url),
      bio: normalizeOptionalText(userRow.bio),
      joinedAt: toIsoDateString(userRow.created_at),
      commentCount: toNonNegativeInt(commentCountResult.rows[0]?.count),
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
}

export const userRepository = new UserRepository();
