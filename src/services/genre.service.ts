import { genreRepository } from "../repositories/genre.repository.js";

export const genreService = {
  listPublicGenres() {
    return genreRepository.listPublicGenres();
  },
};
