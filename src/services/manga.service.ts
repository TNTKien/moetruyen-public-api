import type { MangaDetail, MangaListQuery } from "../contracts/manga.js";
import { mangaRepository } from "../repositories/manga.repository.js";

export const mangaService = {
  listPublicManga(query: MangaListQuery) {
    return mangaRepository.listPublicManga(query);
  },

  getPublicMangaById(id: number): Promise<MangaDetail | null> {
    return mangaRepository.findPublicMangaById(id);
  },
};
