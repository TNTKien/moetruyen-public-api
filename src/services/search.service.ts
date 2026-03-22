import type { SearchMangaItem, SearchMangaQuery } from "../contracts/search.js";
import { AppError } from "../lib/errors.js";

export const searchService = {
  async searchPublicManga(_query: SearchMangaQuery): Promise<SearchMangaItem[]> {
    throw new AppError({
      code: "NOT_IMPLEMENTED",
      message: "searchService.searchPublicManga is not implemented yet",
      status: 501,
    });
  },
};
