import { sql } from "drizzle-orm";
import { foreignKey, index, integer, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";

import { manga } from "./manga.js";

export const genres = pgTable(
  "genres",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity({
      name: "genres_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    name: text().notNull(),
  },
  (table) => [uniqueIndex("idx_genres_name_lower").using("btree", sql`lower(name)`)],
);

export const mangaGenres = pgTable(
  "manga_genres",
  {
    mangaId: integer("manga_id").notNull(),
    genreId: integer("genre_id").notNull(),
  },
  (table) => [
    index("idx_manga_genres_genre_id").using("btree", table.genreId.asc().nullsLast().op("int4_ops")),
    index("idx_manga_genres_manga_id").using("btree", table.mangaId.asc().nullsLast().op("int4_ops")),
    foreignKey({
      columns: [table.genreId],
      foreignColumns: [genres.id],
      name: "manga_genres_genre_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.mangaId],
      foreignColumns: [manga.id],
      name: "manga_genres_manga_id_fkey",
    }).onDelete("cascade"),
    primaryKey({ columns: [table.mangaId, table.genreId], name: "manga_genres_pkey" }),
  ],
);
