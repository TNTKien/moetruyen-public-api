import { z } from "zod";

import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../lib/pagination.js";

export const userUsernameParamsSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]{1,24}$/)
    .transform((value) => value.toLowerCase()),
});

export const userTeamSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  roleLabel: z.string().min(1),
});

export const userSummarySchema = z.object({
  username: z.string().min(1),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  bio: z.string().nullable(),
  joinedAt: z.string().datetime().nullable(),
  commentCount: z.number().int().nonnegative(),
  team: userTeamSchema.nullable(),
});

export const userCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export const userCommentKindSchema = z.enum(["manga_comment", "forum_reply"]);

export const userCommentItemSchema = z.object({
  id: z.number().int().positive(),
  kind: userCommentKindSchema,
  targetTitle: z.string().min(1),
  contextLabel: z.string().min(1),
  contentPreview: z.string().min(1),
  commentPath: z.string().min(1),
  createdAt: z.string().datetime().nullable(),
});

export type UserUsernameParams = z.infer<typeof userUsernameParamsSchema>;
export type UserTeam = z.infer<typeof userTeamSchema>;
export type UserSummary = z.infer<typeof userSummarySchema>;
export type UserCommentsQuery = z.infer<typeof userCommentsQuerySchema>;
export type UserCommentKind = z.infer<typeof userCommentKindSchema>;
export type UserCommentItem = z.infer<typeof userCommentItemSchema>;
