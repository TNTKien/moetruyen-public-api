import { z } from "zod";

import { mangaIdParamsSchema } from "./manga.js";

export const chapterAccessSchema = z.enum(["public", "password_required", "locked"]);

export const chapterItemSchema = z.object({
  id: z.number().int().positive(),
  number: z.number(),
  numberText: z.string().nullable(),
  title: z.string().nullable(),
  date: z.string().datetime().nullable(),
  pages: z.number().int().nonnegative().nullable(),
  groupName: z.string().nullable(),
  viewCount: z.number().int().nonnegative(),
  access: chapterAccessSchema,
});

export const mangaChapterListSchema = z.object({
  manga: z.object({
    id: z.number().int().positive(),
    slug: z.string().min(1),
    title: z.string().min(1),
  }),
  chapters: z.array(chapterItemSchema),
});

export const chapterReaderParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const chapterReaderNavSchema = z.object({
  id: z.number().int().positive(),
  number: z.number(),
  numberText: z.string().nullable(),
  title: z.string().nullable(),
});

export const chapterReaderChapterSchema = chapterItemSchema.extend({
  isOneshot: z.boolean(),
});

export const chapterReaderSchema = z.object({
  manga: z.object({
    id: z.number().int().positive(),
    slug: z.string().min(1),
    title: z.string().min(1),
  }),
  chapter: chapterReaderChapterSchema,
  pageUrls: z.array(z.string().url()),
  prevChapter: chapterReaderNavSchema.nullable(),
  nextChapter: chapterReaderNavSchema.nullable(),
});

export const chapterListParamsSchema = mangaIdParamsSchema;

export type ChapterItem = z.infer<typeof chapterItemSchema>;
export type MangaChapterList = z.infer<typeof mangaChapterListSchema>;
export type ChapterReaderParams = z.infer<typeof chapterReaderParamsSchema>;
export type ChapterReader = z.infer<typeof chapterReaderSchema>;
export type ChapterListParams = z.infer<typeof chapterListParamsSchema>;
