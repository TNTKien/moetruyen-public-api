import { z } from "zod";

export const mangaStatusSchema = z.enum(["ongoing", "completed", "hiatus", "cancelled", "unknown"]);

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
  latestChapterNumber: z.number().nullable(),
  latestChapterNumberText: z.string().nullable(),
  chapterCount: z.number().int().nonnegative(),
  isOneshot: z.boolean(),
  genres: z.array(genreSummarySchema),
});

export const mangaDetailSchema = mangaListItemSchema.extend({
  groupName: z.string().nullable(),
});

export const mangaIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const mangaRandomQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(1),
});

export type GenreSummary = z.infer<typeof genreSummarySchema>;
export type MangaListQuery = z.infer<typeof mangaListQuerySchema>;
export type MangaListItem = z.infer<typeof mangaListItemSchema>;
export type MangaDetail = z.infer<typeof mangaDetailSchema>;
export type MangaIdParams = z.infer<typeof mangaIdParamsSchema>;
export type MangaRandomQuery = z.infer<typeof mangaRandomQuerySchema>;
