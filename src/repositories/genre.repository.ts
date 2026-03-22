import { and, asc, eq, sql } from "drizzle-orm";

import type { GenreListItem } from "../contracts/genre.js";
import { db } from "../db/client.js";
import { genres, mangaGenres } from "../db/schema/genres.js";
import { manga } from "../db/schema/manga.js";

export class GenreRepository {
  async listPublicGenres(): Promise<GenreListItem[]> {
    return db
      .select({
        id: genres.id,
        name: genres.name,
        count: sql<number>`count(distinct ${manga.id})`.mapWith(Number),
      })
      .from(genres)
      .leftJoin(mangaGenres, eq(mangaGenres.genreId, genres.id))
      .leftJoin(manga, and(eq(manga.id, mangaGenres.mangaId), eq(manga.isHidden, 0)))
      .groupBy(genres.id, genres.name)
      .orderBy(asc(genres.name));
  }
}

export const genreRepository = new GenreRepository();
