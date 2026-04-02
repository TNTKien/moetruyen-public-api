import { resolveMangaTopTime, type MangaDetail, type MangaListQuery, type MangaRandomQuery, type MangaTopQuery } from "../contracts/manga.js";
import { mangaRepository } from "../repositories/manga.repository.js";

export const mangaService = {
  listPublicManga(query: MangaListQuery) {
    return mangaRepository.listPublicManga(query);
  },

  listTopPublicManga(query: MangaTopQuery) {
    return mangaRepository.listTopPublicManga({
      ...query,
      time: resolveMangaTopTime(query.sort_by, query.time),
    });
  },

  listRandomPublicManga(query: MangaRandomQuery) {
    return mangaRepository.listRandomPublicManga(query);
  },

  getPublicMangaById(id: number): Promise<MangaDetail | null> {
    return mangaRepository.findPublicMangaById(id);
  },
};
