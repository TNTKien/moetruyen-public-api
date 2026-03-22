import { relations } from "drizzle-orm";

import { chapters } from "./chapters.js";
import { genres, mangaGenres } from "./genres.js";
import { manga } from "./manga.js";

export const mangaRelations = relations(manga, ({ many }) => ({
  chapters: many(chapters),
  mangaGenres: many(mangaGenres),
}));

export const chaptersRelations = relations(chapters, ({ one }) => ({
  manga: one(manga, {
    fields: [chapters.mangaId],
    references: [manga.id],
  }),
}));

export const genresRelations = relations(genres, ({ many }) => ({
  mangaGenres: many(mangaGenres),
}));

export const mangaGenresRelations = relations(mangaGenres, ({ one }) => ({
  manga: one(manga, {
    fields: [mangaGenres.mangaId],
    references: [manga.id],
  }),
  genre: one(genres, {
    fields: [mangaGenres.genreId],
    references: [genres.id],
  }),
}));
