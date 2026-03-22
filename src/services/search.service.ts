import type { SearchMangaItem, SearchMangaQuery } from "../contracts/search.js";
import { mangaRepository } from "../repositories/manga.repository.js";

export const searchService = {
  searchPublicManga(query: SearchMangaQuery): Promise<SearchMangaItem[]> {
    return mangaRepository.searchPublicManga(query);
  },
};
