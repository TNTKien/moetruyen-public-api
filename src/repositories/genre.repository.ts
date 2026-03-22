import type { GenreListItem } from "../contracts/genre.js";
import { AppError } from "../lib/errors.js";

export class GenreRepository {
  async listPublicGenres(): Promise<GenreListItem[]> {
    throw new AppError({
      code: "NOT_IMPLEMENTED",
      message: "GenreRepository.listPublicGenres is not implemented yet",
      status: 501,
    });
  }
}

export const genreRepository = new GenreRepository();
