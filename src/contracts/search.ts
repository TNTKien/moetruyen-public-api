import { z } from "zod";

import { mangaStatusSchema } from "./manga.js";

export const searchMangaQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).describe("Search term matched against manga title, slug, and aliases."),
  limit: z.coerce.number().int().min(1).max(20).default(10).describe("Maximum number of search results to return. Allowed range: `1` to `20`."),
});

export const searchMangaItemSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  title: z.string().min(1),
  cover: z.string().nullable(),
  coverUrl: z.string().url().nullable(),
  coverUpdatedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime().nullable(),
  commentCount: z.number().int().nonnegative(),
  status: mangaStatusSchema,
  isAdult: z.boolean().optional(),
});

export type SearchMangaQuery = z.infer<typeof searchMangaQuerySchema>;
export type SearchMangaItem = z.infer<typeof searchMangaItemSchema>;
