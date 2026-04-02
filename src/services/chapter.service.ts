import { chapterRepository } from "../repositories/chapter.repository.js";
import type { ChapterListQuery } from "../contracts/chapter.js";

export const chapterService = {
  listPublicChaptersByMangaId(mangaId: number, query: ChapterListQuery) {
    return chapterRepository.listPublicChaptersByMangaId(mangaId, query);
  },

  listAggregatePublicChaptersByMangaId(mangaId: number) {
    return chapterRepository.listAggregatePublicChaptersByMangaId(mangaId);
  },

  getPublicChapterReaderById(chapterId: number) {
    return chapterRepository.getPublicChapterReaderById(chapterId);
  },
};
