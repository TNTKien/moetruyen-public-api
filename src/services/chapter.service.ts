import { teamRepository } from "../repositories/team.repository.js";
import { chapterRepository } from "../repositories/chapter.repository.js";
import type { ChapterListQuery } from "../contracts/chapter.js";

const attachGroupsToChapters = async <T extends { groupName: string | null; groups: Array<{ id: number; name: string }> }>(chapters: T[]): Promise<T[]> => {
  const groupsByName = await teamRepository.resolvePublicGroupsByNames(chapters.map((chapter) => chapter.groupName));

  return chapters.map((chapter) => ({
    ...chapter,
    groups: groupsByName.get((chapter.groupName ?? "").trim()) ?? [],
  }));
};

export const chapterService = {
  async listPublicChaptersByMangaId(mangaId: number, query: ChapterListQuery) {
    const result = await chapterRepository.listPublicChaptersByMangaId(mangaId, query);

    if (!result) {
      return null;
    }

    return {
      ...result,
      chapters: await attachGroupsToChapters(result.chapters),
    };
  },

  listAggregatePublicChaptersByMangaId(mangaId: number) {
    return chapterRepository.listAggregatePublicChaptersByMangaId(mangaId);
  },

  async getPublicChapterReaderById(chapterId: number) {
    const result = await chapterRepository.getPublicChapterReaderById(chapterId);

    if (result.kind !== "ok") {
      return result;
    }

    const [chapterWithGroups] = await attachGroupsToChapters([result.data.chapter]);

    if (!chapterWithGroups) {
      return result;
    }

    return {
      ...result,
      data: {
        ...result.data,
        chapter: chapterWithGroups,
      },
    };
  },
};
