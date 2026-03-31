import { z } from "zod";

export const mangaStatusSchema = z.enum(["ongoing", "completed", "hiatus", "cancelled", "unknown"]).describe(
  "Public manga status. Allowed values: `ongoing`, `completed`, `hiatus`, `cancelled`, `unknown`.",
);

export const mangaHasChaptersSchema = z
  .enum(["0", "1"])
  .default("0")
  .transform((value) => Number(value) as 0 | 1)
  .describe("Chapter-presence filter. `0` keeps manga that have chapters. `1` keeps manga that currently have no chapters.");

export const genreSummarySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
});

export const mangaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe("Page number starting from `1`. Used with `limit` for pagination."),
  limit: z.coerce.number().int().min(1).max(100).default(20).describe("Maximum number of manga items to return per page. Allowed range: `1` to `100`."),
  q: z.string().trim().max(100).optional().describe("Free-text search term matched against manga title, slug, and aliases."),
  genre: z.string().trim().max(100).optional().describe("Legacy v1 genre filter. Accepts a genre name, not a genre id."),
  status: mangaStatusSchema.optional().describe("Optional manga status filter. Use one of the documented public status enum values."),
  sort: z.enum(["updated_at", "title", "popular"]).default("updated_at").describe(
    "Sort mode. `updated_at` sorts by recent updates, `title` sorts alphabetically, and `popular` sorts by view-derived popularity.",
  ),
  hasChapters: mangaHasChaptersSchema,
});

export const mangaListItemSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  author: z.string().nullable(),
  status: mangaStatusSchema,
  cover: z.string().nullable(),
  coverUrl: z.string().url().nullable(),
  coverUpdatedAt: z.string().datetime().nullable(),
  groupName: z.string().nullable(),
  createdAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  commentCount: z.number().int().nonnegative(),
  latestChapterNumber: z.number().nullable(),
  latestChapterNumberText: z.string().nullable(),
  chapterCount: z.number().int().nonnegative(),
  isOneshot: z.boolean(),
  genres: z.array(genreSummarySchema),
});

export const mangaTopTimeSchema = z.enum(["24h", "7d", "30d", "all_time"]).describe(
  "Time window used for ranking. `24h`, `7d`, `30d`, or `all_time`.",
);
export const mangaTopSortBySchema = z.enum(["views"]).describe("Current ranking metric. Only `views` is supported.");

export const mangaTopQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe("Page number starting from `1`."),
  limit: z.coerce.number().int().min(1).max(100).default(10).describe("Maximum number of ranked manga items to return per page. Allowed range: `1` to `100`."),
  sort_by: mangaTopSortBySchema.default("views").describe("Ranking metric. Currently only `views` is available."),
  time: mangaTopTimeSchema.default("24h").describe("Ranking window. Use `24h`, `7d`, `30d`, or `all_time`."),
});

export const mangaTopItemSchema = mangaListItemSchema.extend({
  rank: z.number().int().positive(),
  totalViews: z.number().int().nonnegative(),
});

export const mangaDetailSchema = mangaListItemSchema.extend({
  totalViews: z.number().int().nonnegative(),
  bookmarkCount: z.number().int().nonnegative(),
});

export const mangaIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const mangaRandomQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(1).describe("Number of random manga items to return. Allowed range: `1` to `10`."),
});

export type GenreSummary = z.infer<typeof genreSummarySchema>;
export type MangaListQuery = z.infer<typeof mangaListQuerySchema>;
export type MangaListItem = z.infer<typeof mangaListItemSchema>;
export type MangaTopSortBy = z.infer<typeof mangaTopSortBySchema>;
export type MangaTopTime = z.infer<typeof mangaTopTimeSchema>;
export type MangaTopQuery = z.infer<typeof mangaTopQuerySchema>;
export type MangaTopItem = z.infer<typeof mangaTopItemSchema>;
export type MangaDetail = z.infer<typeof mangaDetailSchema>;
export type MangaIdParams = z.infer<typeof mangaIdParamsSchema>;
export type MangaRandomQuery = z.infer<typeof mangaRandomQuerySchema>;
