import type { MangaDetail, MangaListQuery } from "../contracts/manga.js";
import { mangaRepository } from "../repositories/manga.repository.js";

export const mangaService = {
  listPublicManga(query: MangaListQuery) {
    return mangaRepository.listPublicManga(query);
  },

  getPublicMangaBySlug(slug: string): Promise<MangaDetail | null> {
    return mangaRepository.findPublicMangaBySlug(slug);
  },
};
