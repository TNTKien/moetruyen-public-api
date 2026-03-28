import { z } from "zod";

import { chapterAccessSchema, chapterReaderParamsSchema } from "./chapter.js";
import { mangaIdParamsSchema } from "./manga.js";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../lib/pagination.js";

export const commentSortSchema = z.literal("created_at");
export const commentOrderSchema = z.enum(["asc", "desc"]);

export const commentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  sort: commentSortSchema.default("created_at"),
  order: commentOrderSchema.default("desc"),
});

export const commentAuthorSchema = z.object({
  name: z.string().min(1),
  username: z.string().nullable(),
  userId: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
});

export const commentContextMangaSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  title: z.string().min(1),
});

export const commentContextChapterSchema = z.object({
  id: z.number().int().positive(),
  number: z.number(),
  numberText: z.string().nullable(),
  access: chapterAccessSchema,
}).nullable();

export const recentCommentItemSchema = z.object({
  id: z.number().int().positive(),
  content: z.string().min(1),
  contentPreview: z.string().min(1),
  createdAt: z.string().datetime().nullable(),
  commentPage: z.number().int().positive(),
  commentPath: z.string().min(1),
  author: commentAuthorSchema,
  manga: commentContextMangaSchema,
  chapter: commentContextChapterSchema,
});

export const commentReplyItemSchema = z.object({
  id: z.number().int().positive(),
  content: z.string().min(1),
  createdAt: z.string().datetime().nullable(),
  commentPath: z.string().min(1),
  author: commentAuthorSchema,
});

export const commentThreadItemSchema = z.object({
  id: z.number().int().positive(),
  content: z.string().min(1),
  createdAt: z.string().datetime().nullable(),
  commentPath: z.string().min(1),
  author: commentAuthorSchema,
  replies: z.array(commentReplyItemSchema),
});

export const commentMangaParamsSchema = mangaIdParamsSchema;
export const commentChapterParamsSchema = chapterReaderParamsSchema;

export type CommentSort = z.infer<typeof commentSortSchema>;
export type CommentOrder = z.infer<typeof commentOrderSchema>;
export type CommentListQuery = z.infer<typeof commentListQuerySchema>;
export type CommentAuthor = z.infer<typeof commentAuthorSchema>;
export type RecentCommentItem = z.infer<typeof recentCommentItemSchema>;
export type CommentReplyItem = z.infer<typeof commentReplyItemSchema>;
export type CommentThreadItem = z.infer<typeof commentThreadItemSchema>;
export type CommentMangaParams = z.infer<typeof commentMangaParamsSchema>;
export type CommentChapterParams = z.infer<typeof commentChapterParamsSchema>;
