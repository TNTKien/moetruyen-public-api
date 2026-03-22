import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, pgTable, text, unique } from "drizzle-orm/pg-core";

export const manga = pgTable(
  "manga",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity({
      name: "manga_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    title: text().notNull(),
    slug: text().notNull(),
    author: text().notNull(),
    genres: text(),
    status: text(),
    description: text(),
    cover: text(),
    archive: text(),
    updatedAt: text("updated_at").notNull(),
    createdAt: text("created_at").notNull(),
    isHidden: integer("is_hidden").default(0).notNull(),
    groupName: text("group_name"),
    otherNames: text("other_names"),
    coverUpdatedAt: bigint("cover_updated_at", { mode: "number" }),
    isOneshot: boolean("is_oneshot").default(false).notNull(),
    oneshotLocked: boolean("oneshot_locked").default(false).notNull(),
  },
  (table) => [
    unique("manga_slug_key").on(table.slug),
    index("idx_manga_id").using("btree", table.id.asc().nullsLast().op("int4_ops")),
    index("idx_manga_slug_lower_prefix").using("btree", sql`lower(slug)`),
    index("idx_manga_status_visible").using(
      "btree",
      table.isHidden.asc().nullsLast().op("int4_ops"),
      table.status.asc().nullsLast().op("int4_ops"),
    ),
    index("idx_manga_title_lower_prefix").using("btree", sql`lower(title)`),
    index("idx_manga_title_trgm").using("gin", table.title.asc().nullsLast().op("gin_trgm_ops")),
    index("idx_manga_visible_updated").using(
      "btree",
      table.isHidden.asc().nullsLast().op("int4_ops"),
      table.updatedAt.desc().nullsFirst().op("int4_ops"),
      table.id.desc().nullsFirst().op("text_ops"),
    ),
  ],
);
