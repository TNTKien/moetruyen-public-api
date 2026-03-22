import type { MangaChapterList } from "../contracts/chapter.js";
import { AppError } from "../lib/errors.js";

export class ChapterRepository {
  async listPublicChaptersByMangaSlug(_slug: string): Promise<MangaChapterList | null> {
    throw new AppError({
      code: "NOT_IMPLEMENTED",
      message: "ChapterRepository.listPublicChaptersByMangaSlug is not implemented yet",
      status: 501,
    });
  }
}

export const chapterRepository = new ChapterRepository();
