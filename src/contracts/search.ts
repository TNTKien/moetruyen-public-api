import { z } from "zod";

import { mangaStatusSchema } from "./manga.js";

export const searchMangaQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const searchMangaItemSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  title: z.string().min(1),
  cover: z.string().nullable(),
  coverUrl: z.string().url().nullable(),
  coverUpdatedAt: z.string().datetime().nullable(),
  status: mangaStatusSchema,
  isAdult: z.boolean().optional(),
});

export type SearchMangaQuery = z.infer<typeof searchMangaQuerySchema>;
export type SearchMangaItem = z.infer<typeof searchMangaItemSchema>;
