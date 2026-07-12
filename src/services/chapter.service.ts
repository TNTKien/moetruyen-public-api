import { teamRepository } from "../repositories/team.repository.js";
import { chapterRepository } from "../repositories/chapter.repository.js";
import type { ChapterListQuery } from "../contracts/chapter.js";

const normalizeGroupName = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

const getGroupNameTokens = (value: string | null) =>
  new Set(
    (value ?? "")
      .split(/\s*(?:\/|&|\+|;|\||,)\s*|\s+x\s+/i)
      .map(normalizeGroupName)
      .filter(Boolean),
  );

const attachGroupsToChapters = async <T extends { groupName: string | null; groups: Array<{ id: number; name: string }> }>(mangaId: number, chapters: T[]): Promise<T[]> => {
  const linkedGroups = (await teamRepository.resolvePublicGroupsByMangaIds([mangaId])).get(mangaId) ?? [];

  return chapters.map((chapter) => ({
    ...chapter,
    groups: linkedGroups.filter((group) => getGroupNameTokens(chapter.groupName).has(normalizeGroupName(group.name))),
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
      chapters: await attachGroupsToChapters(mangaId, result.chapters),
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

    const [chapterWithGroups] = await attachGroupsToChapters(result.data.manga.id, [result.data.chapter]);

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

  getPublicChapterPageAccessById(chapterId: number, pageIndexes: number[], sessionId: string) {
    return chapterRepository.getPublicChapterPageAccessById(chapterId, pageIndexes, sessionId);
  },
};
