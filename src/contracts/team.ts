import { z } from "zod";

import { chapterAccessSchema } from "./chapter.js";
import { mangaStatusSchema } from "./manga.js";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../lib/pagination.js";

export const teamIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const teamSummarySchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().min(1),
  intro: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  coverUrl: z.string().url().nullable(),
  memberCount: z.number().int().nonnegative(),
  leaderCount: z.number().int().nonnegative(),
  totalMangaCount: z.number().int().nonnegative(),
  totalChapterCount: z.number().int().nonnegative(),
  totalCommentCount: z.number().int().nonnegative(),
});

export const teamMemberSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: z.string().min(1),
  roleLabel: z.string().min(1),
});

export const teamListSortSchema = z.enum([
  "updated_at",
  "member_count",
  "manga_count",
  "chapter_count",
  "comment_count",
]).describe("Team list sort mode. Use `updated_at`, `member_count`, `manga_count`, `chapter_count`, or `comment_count`.");

export const teamListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE).describe("Page number starting from `1`."),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Maximum number of teams to return per page. Allowed range: `1` to `100`."),
  q: z.string().trim().max(100).optional().describe("Free-text search term matched against team name, slug, and intro."),
  sort: teamListSortSchema.default("updated_at").describe("Sort mode for the team list."),
});

export const teamMangaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE).describe("Page number starting from `1`."),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Maximum number of manga items to return per page. Allowed range: `1` to `100`."),
  q: z.string().trim().max(100).optional().describe("Free-text search term matched against manga title, slug, and aliases."),
  genre: z.string().trim().max(100).optional().describe("Legacy v1 team-manga genre filter. Accepts a genre name, not a genre id."),
  status: mangaStatusSchema.optional().describe("Optional manga status filter for the team manga listing."),
  sort: z.enum(["updated_at", "title", "popular"]).default("updated_at").describe(
    "Sort mode. `updated_at` sorts by recent updates, `title` sorts alphabetically, and `popular` sorts by view-derived popularity.",
  ),
});

export const teamUpdatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE).describe("Page number starting from `1`."),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Maximum number of team updates to return per page. Allowed range: `1` to `100`."),
});

export const teamUpdateItemSchema = z.object({
  manga: z.object({
    id: z.number().int().positive(),
    slug: z.string().min(1),
    title: z.string().min(1),
  }),
  chapter: z.object({
    id: z.number().int().positive(),
    number: z.number(),
    numberText: z.string().nullable(),
    title: z.string().nullable(),
    date: z.string().datetime().nullable(),
    pages: z.number().int().nonnegative().nullable(),
    access: chapterAccessSchema,
    isOneshot: z.boolean(),
    groupName: z.string().nullable(),
  }),
});

export type TeamIdParams = z.infer<typeof teamIdParamsSchema>;
export type TeamListQuery = z.infer<typeof teamListQuerySchema>;
export type TeamListSort = z.infer<typeof teamListSortSchema>;
export type TeamSummary = z.infer<typeof teamSummarySchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamMangaListQuery = z.infer<typeof teamMangaListQuerySchema>;
export type TeamUpdatesQuery = z.infer<typeof teamUpdatesQuerySchema>;
export type TeamUpdateItem = z.infer<typeof teamUpdateItemSchema>;
