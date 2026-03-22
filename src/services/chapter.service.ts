import { chapterRepository } from "../repositories/chapter.repository.js";

export const chapterService = {
  listPublicChaptersByMangaId(mangaId: number) {
    return chapterRepository.listPublicChaptersByMangaId(mangaId);
  },

  getPublicChapterReaderById(chapterId: number) {
    return chapterRepository.getPublicChapterReaderById(chapterId);
  },
};
