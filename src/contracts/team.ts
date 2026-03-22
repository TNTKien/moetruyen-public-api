import { z } from "zod";

import { mangaListQuerySchema } from "./manga.js";

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

export type TeamIdParams = z.infer<typeof teamIdParamsSchema>;
export type TeamSummary = z.infer<typeof teamSummarySchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamMangaListQuery = z.infer<typeof teamMangaListQuerySchema>;
