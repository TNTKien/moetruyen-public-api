import { z } from "zod";

import { chapterAccessSchema } from "./chapter.js";
import { mangaListQuerySchema } from "./manga.js";
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

export const teamMangaListQuerySchema = mangaListQuerySchema;

export const teamUpdatesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
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
export type TeamSummary = z.infer<typeof teamSummarySchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamMangaListQuery = z.infer<typeof teamMangaListQuerySchema>;
export type TeamUpdatesQuery = z.infer<typeof teamUpdatesQuerySchema>;
export type TeamUpdateItem = z.infer<typeof teamUpdateItemSchema>;
