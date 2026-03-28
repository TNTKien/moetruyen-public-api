import { z } from "zod";

export const mangaStatusSchema = z.enum(["ongoing", "completed", "hiatus", "cancelled", "unknown"]);

export const mangaHasChaptersSchema = z
  .enum(["0", "1"])
  .default("0")
  .transform((value) => Number(value) as 0 | 1);

export const genreSummarySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
});

export const mangaListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
  genre: z.string().trim().max(100).optional(),
  status: mangaStatusSchema.optional(),
  sort: z.enum(["updated_at", "title", "popular"]).default("updated_at"),
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

export const mangaTopTimeSchema = z.enum(["24h", "7d", "30d", "all_time"]);
export const mangaTopSortBySchema = z.enum(["views"]);

export const mangaTopQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort_by: mangaTopSortBySchema.default("views"),
  time: mangaTopTimeSchema.default("24h"),
});

export const mangaTopItemSchema = mangaListItemSchema.extend({
  rank: z.number().int().positive(),
  totalViews: z.number().int().nonnegative(),
});

export const mangaDetailSchema = mangaListItemSchema;

export const mangaIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const mangaRandomQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(1),
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
