import type { MangaDetail, MangaListItem, MangaListQuery } from "../contracts/manga.js";
import { AppError } from "../lib/errors.js";

export interface PublicMangaListResult {
  items: MangaListItem[];
  total: number;
}

export class MangaRepository {
  async listPublicManga(_query: MangaListQuery): Promise<PublicMangaListResult> {
    throw new AppError({
      code: "NOT_IMPLEMENTED",
      message: "MangaRepository.listPublicManga is not implemented yet",
      status: 501,
    });
  }

  async findPublicMangaBySlug(_slug: string): Promise<MangaDetail | null> {
    throw new AppError({
      code: "NOT_IMPLEMENTED",
      message: "MangaRepository.findPublicMangaBySlug is not implemented yet",
      status: 501,
    });
  }
}

export const mangaRepository = new MangaRepository();
