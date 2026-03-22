import { bigint, boolean, foreignKey, integer, numeric, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { manga } from "./manga.js";

export const chapters = pgTable(
  "chapters",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity({
      name: "chapters_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    mangaId: integer("manga_id").notNull(),
    number: numeric({ precision: 10, scale: 3 }).notNull(),
    title: text().notNull(),
    pages: integer().notNull(),
    date: text().notNull(),
    groupName: text("group_name"),
    pagesPrefix: text("pages_prefix"),
    pagesExt: text("pages_ext"),
    pagesUpdatedAt: bigint("pages_updated_at", { mode: "number" }),
    processingState: text("processing_state"),
    processingError: text("processing_error"),
    processingDraftToken: text("processing_draft_token"),
    processingPagesJson: text("processing_pages_json"),
    processingUpdatedAt: bigint("processing_updated_at", { mode: "number" }),
    isOneshot: boolean("is_oneshot").default(false).notNull(),
    passwordHash: text("password_hash"),
    passwordSalt: text("password_salt"),
    passwordUpdatedAt: bigint("password_updated_at", { mode: "number" }),
    pagesFilePrefix: text("pages_file_prefix"),
  },
  (table) => [
    uniqueIndex("idx_chapters_manga_number").using(
      "btree",
      table.mangaId.asc().nullsLast().op("int4_ops"),
      table.number.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.mangaId],
      foreignColumns: [manga.id],
      name: "chapters_manga_id_fkey",
    }).onDelete("cascade"),
  ],
);
