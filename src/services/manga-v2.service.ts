import type { GenreSummary, MangaListItem } from "../contracts/manga.js";
import type { MangaV2Base, MangaV2Include, MangaV2Item, MangaV2RandomQuery, MangaV2SearchQuery, MangaV2Stats, MangaV2TeamMangaQuery, MangaV2TopItem, MangaV2TopQuery } from "../contracts/manga-v2.js";
import { mangaRepository } from "../repositories/manga.repository.js";
import { mangaService } from "./manga.service.js";
import { teamService } from "./team.service.js";

const hasInclude = (includes: MangaV2Include[], include: MangaV2Include) => includes.includes(include);

const mapMangaBase = (item: Pick<MangaListItem, "id" | "slug" | "title" | "description" | "author" | "status" | "cover" | "coverUrl" | "coverUpdatedAt" | "groupName" | "createdAt" | "updatedAt" | "isOneshot" | "chapterCount" | "latestChapterNumber" | "latestChapterNumberText">): MangaV2Base => ({
  id: item.id,
  slug: item.slug,
  title: item.title,
  description: item.description,
  author: item.author,
  status: item.status,
  cover: item.cover,
  coverUrl: item.coverUrl,
  coverUpdatedAt: item.coverUpdatedAt,
  groupName: item.groupName,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  isOneshot: item.isOneshot,
  chapterCount: item.chapterCount,
  latestChapterNumber: item.latestChapterNumber,
  latestChapterNumberText: item.latestChapterNumberText,
});

const getOptionalGenres = (item: Pick<MangaListItem, "genres">, includes: MangaV2Include[]): GenreSummary[] | undefined =>
  hasInclude(includes, "genres") ? item.genres : undefined;

const buildStatsById = async (items: Array<{ id: number }>, includes: MangaV2Include[]) => {
  if (!hasInclude(includes, "stats")) {
    return null;
  }

  const statsMap = await mangaRepository.getPublicMangaStatsByIds(items.map((item) => item.id));

  return new Map(
    items.map((item) => {
      const stats = statsMap.get(item.id);
      return [
        item.id,
        {
          commentCount: stats?.commentCount ?? 0,
          totalViews: stats?.totalViews ?? 0,
          bookmarkCount: stats?.bookmarkCount ?? 0,
        } satisfies MangaV2Stats,
      ] as const;
    }),
  );
};

const buildMangaV2Item = (
  item: Pick<MangaListItem, "id" | "slug" | "title" | "description" | "author" | "status" | "cover" | "coverUrl" | "coverUpdatedAt" | "groupName" | "createdAt" | "updatedAt" | "isOneshot" | "chapterCount" | "latestChapterNumber" | "latestChapterNumberText" | "genres">,
  includes: MangaV2Include[],
  stats: MangaV2Stats | undefined,
): MangaV2Item => {
  const base = mapMangaBase(item);
  const genres = getOptionalGenres(item, includes);

  return {
    ...base,
    ...(stats ? { stats } : {}),
    ...(genres ? { genres } : {}),
  };
};

export const mangaV2Service = {
  async listPublicManga(query: import("../contracts/manga-v2.js").MangaV2ListQuery): Promise<{ items: MangaV2Item[]; total: number }> {
    const result = await mangaRepository.listPublicMangaV2(query);
    const statsById = await buildStatsById(result.items, query.include);

    return {
      items: result.items.map((item) => buildMangaV2Item(item, query.include, statsById?.get(item.id))),
      total: result.total,
    };
  },

  async getPublicMangaById(id: number, includes: MangaV2Include[]): Promise<MangaV2Item | null> {
    const item = await mangaService.getPublicMangaById(id);

    if (!item) {
      return null;
    }

    const statsById = await buildStatsById([item], includes);

    return buildMangaV2Item(item, includes, statsById?.get(item.id));
  },

  async listTopPublicManga(query: MangaV2TopQuery): Promise<{ items: MangaV2TopItem[]; total: number }> {
    const result = await mangaService.listTopPublicManga(query);
    const statsById = await buildStatsById(result.items, query.include);

    return {
      items: result.items.map((item) => ({
        ...buildMangaV2Item(item, query.include, statsById?.get(item.id)),
        ranking: {
          rank: item.rank,
          sortBy: query.sort_by,
          time: query.time,
          value: item.totalViews,
        },
      })),
      total: result.total,
    };
  },

  async listRandomPublicManga(query: MangaV2RandomQuery): Promise<MangaV2Item[]> {
    const items = await mangaService.listRandomPublicManga(query);
    const statsById = await buildStatsById(items, query.include);

    return items.map((item) => buildMangaV2Item(item, query.include, statsById?.get(item.id)));
  },

  async searchPublicManga(query: MangaV2SearchQuery): Promise<MangaV2Item[]> {
    const result = await mangaRepository.listPublicMangaV2({
      page: 1,
      limit: query.limit,
      q: query.q,
      sort: "updated_at",
      hasChapters: 0,
      genre: undefined,
      genrex: undefined,
      status: undefined,
      include: [],
    });
    const statsById = await buildStatsById(result.items, query.include);

    return result.items.map((item) => buildMangaV2Item(item, query.include, statsById?.get(item.id)));
  },

  async listPublicTeamMangaByTeamId(id: number, query: MangaV2TeamMangaQuery): Promise<{ items: MangaV2Item[]; total: number } | null> {
    const team = await teamService.getPublicTeamById(id);

    if (!team) {
      return null;
    }

    const result = await mangaRepository.listPublicMangaByGroupNameV2(team.name, query);

    const statsById = await buildStatsById(result.items, query.include);

    return {
      items: result.items.map((item) => buildMangaV2Item(item, query.include, statsById?.get(item.id))),
      total: result.total,
    };
  },
};
