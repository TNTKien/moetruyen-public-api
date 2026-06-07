import { z } from "zod";

import { groupSummarySchema, mangaIdParamsSchema } from "./manga.js";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../lib/pagination.js";

export const chapterAccessSchema = z.enum(["public", "password_required", "interaction_boost_enabled", "locked"]);

const chapterListMangaSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  title: z.string().min(1),
});

export const chapterItemSchema = z.object({
  id: z.number().int().positive(),
  number: z.number(),
  numberText: z.string().nullable(),
  title: z.string().nullable(),
  date: z.string().datetime().nullable(),
  pages: z.number().int().nonnegative().nullable(),
  groupName: z.string().nullable(),
  groups: z.array(groupSummarySchema),
  viewCount: z.number().int().nonnegative(),
  access: chapterAccessSchema,
});

export const chapterAggregateItemSchema = z.object({
  id: z.number().int().positive(),
  number: z.number(),
  numberText: z.string().nullable(),
  title: z.string().nullable(),
  date: z.string().datetime().nullable(),
  access: chapterAccessSchema,
});

export const chapterListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE).describe("Page number starting from `1`."),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Maximum number of chapters to return per page. Allowed range: `1` to `100`."),
});

export const mangaChapterListSchema = z.object({
  manga: chapterListMangaSchema,
  chapters: z.array(chapterItemSchema),
});

export const mangaChapterAggregateListSchema = z.object({
  manga: chapterListMangaSchema,
  chapters: z.array(chapterAggregateItemSchema),
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

export const chapterPageAccessBodySchema = z.object({
  pageIndexes: z.array(z.coerce.number().int().nonnegative()).min(1),
});

export const imgxPageGrantSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal("IMGX-GRANT-WRAP-v1"),
  codecVersions: z.tuple([z.literal(2), z.literal(3)]),
  defaultCodecVersion: z.literal(3),
  contentAlgorithm: z.literal("IMGX-AES-256-GCM-HKDF-v3"),
  legacyAlgorithm: z.literal("IMGX-HMAC-SHA256-v2"),
  imageId: z.string().min(1),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  nonce: z.string().min(1),
  keyNonce: z.string().min(1),
  keyHash: z.string().min(1),
  contentKeyHash: z.string().min(1),
  signature: z.string().min(1),
  wrappedDecodeKey: z.string().min(1),
  wrappedContentKey: z.string().min(1),
});

export const chapterPageAccessPageSchema = z.object({
  pageIndex: z.number().int().nonnegative(),
  pageNumber: z.number().int().positive(),
  storageKey: z.string().min(1),
  downloadUrl: z.string().url(),
  grant: imgxPageGrantSchema,
});

export const chapterPageAccessSchema = z.object({
  chapterId: z.number().int().positive(),
  ttlMs: z.number().int().positive(),
  maxWindow: z.number().int().positive(),
  pages: z.array(chapterPageAccessPageSchema),
});

export const chapterListParamsSchema = mangaIdParamsSchema;

export type ChapterItem = z.infer<typeof chapterItemSchema>;
export type ChapterAggregateItem = z.infer<typeof chapterAggregateItemSchema>;
export type MangaChapterList = z.infer<typeof mangaChapterListSchema>;
export interface PaginatedMangaChapterListResult extends MangaChapterList {
  total: number;
}
export type MangaChapterAggregateList = z.infer<typeof mangaChapterAggregateListSchema>;
export type ChapterReaderParams = z.infer<typeof chapterReaderParamsSchema>;
export type ChapterReader = z.infer<typeof chapterReaderSchema>;
export type ChapterPageAccessBody = z.infer<typeof chapterPageAccessBodySchema>;
export type ChapterPageAccess = z.infer<typeof chapterPageAccessSchema>;
export type ChapterListParams = z.infer<typeof chapterListParamsSchema>;
export type ChapterListQuery = z.infer<typeof chapterListQuerySchema>;
