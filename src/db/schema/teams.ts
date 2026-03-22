import { bigint, boolean, integer, pgTable, text } from "drizzle-orm/pg-core";

export const translationTeams = pgTable("translation_teams", {
  id: integer().primaryKey(),
  name: text().notNull(),
  slug: text().notNull(),
  intro: text().notNull(),
  facebookUrl: text("facebook_url"),
  discordUrl: text("discord_url"),
  status: text().notNull(),
  createdByUserId: text("created_by_user_id"),
  approvedByUserId: text("approved_by_user_id"),
  approvedAt: bigint("approved_at", { mode: "number" }),
  rejectReason: text("reject_reason"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
});

export const translationTeamMembers = pgTable("translation_team_members", {
  teamId: integer("team_id").notNull(),
  userId: text("user_id").notNull(),
  role: text().notNull(),
  status: text().notNull(),
  requestedAt: bigint("requested_at", { mode: "number" }).notNull(),
  reviewedAt: bigint("reviewed_at", { mode: "number" }),
  reviewedByUserId: text("reviewed_by_user_id"),
  canAddManga: boolean("can_add_manga").notNull(),
  canEditManga: boolean("can_edit_manga").notNull(),
  canDeleteManga: boolean("can_delete_manga").notNull(),
  canAddChapter: boolean("can_add_chapter").notNull(),
  canEditChapter: boolean("can_edit_chapter").notNull(),
  canDeleteChapter: boolean("can_delete_chapter").notNull(),
});
