import type { MangaDetail, MangaListQuery, MangaRandomQuery, MangaTopQuery } from "../contracts/manga.js";
import { mangaRepository } from "../repositories/manga.repository.js";

export const mangaService = {
  listPublicManga(query: MangaListQuery) {
    return mangaRepository.listPublicManga(query);
  },

  listTopPublicManga(query: MangaTopQuery) {
    return mangaRepository.listTopPublicManga(query);
  },

  listRandomPublicManga(query: MangaRandomQuery) {
    return mangaRepository.listRandomPublicManga(query);
  },

  getPublicMangaById(id: number): Promise<MangaDetail | null> {
    return mangaRepository.findPublicMangaById(id);
  },
};
