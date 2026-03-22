import { chapterRepository } from "../repositories/chapter.repository.js";

export const chapterService = {
  listPublicChaptersByMangaSlug(slug: string) {
    return chapterRepository.listPublicChaptersByMangaSlug(slug);
  },

  getPublicChapterReaderById(slug: string, chapterId: number) {
    return chapterRepository.getPublicChapterReaderById(slug, chapterId);
  },
};
