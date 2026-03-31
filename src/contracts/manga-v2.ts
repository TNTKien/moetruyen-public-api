import { z } from "zod";

import { genreSummarySchema, mangaIdParamsSchema, mangaListItemSchema, mangaListQuerySchema, mangaTopQuerySchema, mangaTopSortBySchema, mangaTopTimeSchema, mangaRandomQuerySchema } from "./manga.js";
import { searchMangaQuerySchema } from "./search.js";
import { teamMangaListQuerySchema } from "./team.js";

const parseGenreIdsValue = (value: string | number | undefined, ctx: z.RefinementCtx): number[] | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const raw = String(value).trim();

  if (!raw) {
    return undefined;
  }

  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );

  const parsedIds: number[] = [];

  for (const id of ids) {
    const parsed = z.coerce.number().int().positive().safeParse(id);

    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid genre id: ${id}`,
      });
      return z.NEVER;
    }

    parsedIds.push(parsed.data);
  }

  return parsedIds;
};

export const mangaV2GenreIdsSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value, ctx) => parseGenreIdsValue(value as string | number | undefined, ctx));

export const mangaV2IncludeItemSchema = z.enum(["stats", "genres"]);

const parseIncludeValue = (value: string | undefined, ctx: z.RefinementCtx): Array<z.infer<typeof mangaV2IncludeItemSchema>> => {
  if (!value) {
    return [];
  }

  const items = Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );

  const parsedItems: Array<z.infer<typeof mangaV2IncludeItemSchema>> = [];

  for (const item of items) {
    const parsed = mangaV2IncludeItemSchema.safeParse(item);

    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid include value: ${item}`,
      });
      return z.NEVER;
    }

    parsedItems.push(parsed.data);
  }

  return parsedItems;
};

export const mangaV2IncludeQuerySchema = z.string().trim().optional().transform((value, ctx) => parseIncludeValue(value, ctx));

export const mangaV2BaseSchema = mangaListItemSchema.pick({
  id: true,
  slug: true,
  title: true,
  description: true,
  author: true,
  status: true,
  cover: true,
  coverUrl: true,
  coverUpdatedAt: true,
  groupName: true,
  createdAt: true,
  updatedAt: true,
  isOneshot: true,
  chapterCount: true,
  latestChapterNumber: true,
  latestChapterNumberText: true,
});

export const mangaV2StatsSchema = z.object({
  commentCount: z.number().int().nonnegative(),
  totalViews: z.number().int().nonnegative(),
  bookmarkCount: z.number().int().nonnegative(),
});

export const mangaV2ItemSchema = mangaV2BaseSchema.extend({
  stats: mangaV2StatsSchema.optional(),
  genres: z.array(genreSummarySchema).optional(),
});

export const mangaV2RankingSchema = z.object({
  rank: z.number().int().positive(),
  sortBy: mangaTopSortBySchema,
  time: mangaTopTimeSchema,
  value: z.number().int().nonnegative(),
});

export const mangaV2TopItemSchema = mangaV2ItemSchema.extend({
  ranking: mangaV2RankingSchema,
});

export const mangaV2ListQuerySchema = mangaListQuerySchema.extend({
  genre: mangaV2GenreIdsSchema,
  genrex: mangaV2GenreIdsSchema,
  include: mangaV2IncludeQuerySchema,
});

export const mangaV2DetailQuerySchema = z.object({
  include: mangaV2IncludeQuerySchema,
});

export const mangaV2TopQuerySchema = mangaTopQuerySchema.extend({
  include: mangaV2IncludeQuerySchema,
});

export const mangaV2RandomQuerySchema = mangaRandomQuerySchema.extend({
  include: mangaV2IncludeQuerySchema,
});

export const mangaV2SearchQuerySchema = searchMangaQuerySchema.extend({
  include: mangaV2IncludeQuerySchema,
});

export const mangaV2TeamMangaQuerySchema = teamMangaListQuerySchema.extend({
  genre: mangaV2GenreIdsSchema,
  genrex: mangaV2GenreIdsSchema,
  include: mangaV2IncludeQuerySchema,
});

export const mangaV2IdParamsSchema = mangaIdParamsSchema;

export type MangaV2Include = z.infer<typeof mangaV2IncludeItemSchema>;
export type MangaV2Base = z.infer<typeof mangaV2BaseSchema>;
export type MangaV2Stats = z.infer<typeof mangaV2StatsSchema>;
export type MangaV2Item = z.infer<typeof mangaV2ItemSchema>;
export type MangaV2TopItem = z.infer<typeof mangaV2TopItemSchema>;
export type MangaV2ListQuery = z.infer<typeof mangaV2ListQuerySchema>;
export type MangaV2DetailQuery = z.infer<typeof mangaV2DetailQuerySchema>;
export type MangaV2TopQuery = z.infer<typeof mangaV2TopQuerySchema>;
export type MangaV2RandomQuery = z.infer<typeof mangaV2RandomQuerySchema>;
export type MangaV2SearchQuery = z.infer<typeof mangaV2SearchQuerySchema>;
export type MangaV2TeamMangaQuery = z.infer<typeof mangaV2TeamMangaQuerySchema>;
export type MangaV2IdParams = z.infer<typeof mangaV2IdParamsSchema>;
