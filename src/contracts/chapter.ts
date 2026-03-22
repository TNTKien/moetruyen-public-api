import { z } from "zod";

import { mangaSlugParamsSchema } from "./manga.js";

export const chapterItemSchema = z.object({
  id: z.number().int().positive(),
  number: z.number(),
  numberText: z.string().nullable(),
  title: z.string().nullable(),
  date: z.string().datetime().nullable(),
  pages: z.number().int().nonnegative().nullable(),
});

export const mangaChapterListSchema = z.object({
  manga: z.object({
    id: z.number().int().positive(),
    slug: z.string().min(1),
    title: z.string().min(1),
  }),
  chapters: z.array(chapterItemSchema),
});

export const chapterListParamsSchema = mangaSlugParamsSchema;

export type ChapterItem = z.infer<typeof chapterItemSchema>;
export type MangaChapterList = z.infer<typeof mangaChapterListSchema>;
export type ChapterListParams = z.infer<typeof chapterListParamsSchema>;
