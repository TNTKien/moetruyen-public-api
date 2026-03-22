import { z } from "zod";

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

export type UserUsernameParams = z.infer<typeof userUsernameParamsSchema>;
export type UserTeam = z.infer<typeof userTeamSchema>;
export type UserSummary = z.infer<typeof userSummarySchema>;
