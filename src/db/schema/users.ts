import { bigint, pgTable, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text().primaryKey(),
  email: text(),
  username: text().notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  badge: text().notNull(),
  facebookUrl: text("facebook_url"),
  discordHandle: text("discord_handle"),
  bio: text(),
});
