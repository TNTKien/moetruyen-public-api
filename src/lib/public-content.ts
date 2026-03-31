import { env } from "../config/env.js";
import type { MangaListItem } from "../contracts/manga.js";

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const WHITESPACE_PATTERN = /\s+/g;
const PAGE_FILE_PREFIX_PATTERN = /^[a-zA-Z]{5}$/;

export const HEADER_SEARCH_MAX_RESULTS = 5;
export const HEADER_SEARCH_MAX_QUERY_LENGTH = 80;
export const API_SEARCH_MAX_QUERY_LENGTH = 100;

export type PublicMangaStatus = MangaListItem["status"];

export const normalizeSearchTerm = (value: string, maxLength = API_SEARCH_MAX_QUERY_LENGTH): string => {
  return value.replace(WHITESPACE_PATTERN, " ").trim().slice(0, maxLength);
};

export const parseNumericValue = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

export const formatNumericText = (value: string | number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text.length > 0 ? text : null;
};

export const normalizeMangaStatus = (value: string | null | undefined): PublicMangaStatus => {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "ongoing" || normalized === "còn tiếp") {
    return "ongoing";
  }

  if (normalized === "completed" || normalized === "hoàn thành") {
    return "completed";
  }

  if (normalized === "hiatus" || normalized === "tạm dừng") {
    return "hiatus";
  }

  if (normalized === "cancelled" || normalized === "canceled" || normalized === "dropped" || normalized === "đã hủy") {
    return "cancelled";
  }

  return "unknown";
};

export const toIsoDateString = (value: string | number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = parseNumericValue(value);
  const date =
    numeric !== null
      ? new Date(numeric > 0 && numeric < 1_000_000_000_000 ? numeric * 1000 : numeric)
      : new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const buildAbsoluteUrl = (value: string, baseUrl: string): string => {
  if (ABSOLUTE_URL_PATTERN.test(value)) {
    return value;
  }

  return new URL(value.replace(/^\/+/, ""), `${baseUrl.replace(/\/?$/, "/")}`).toString();
};

const appendCacheToken = (url: string, token: string | number | null | undefined): string => {
  const numericToken = parseNumericValue(token);

  if (numericToken === null || numericToken <= 0) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}t=${numericToken}`;
};

export const buildCoverUrl = (cover: string | null | undefined, coverUpdatedAt: string | number | null | undefined): string | null => {
  if (!cover) {
    return null;
  }

  return appendCacheToken(buildAbsoluteUrl(cover, env.COVER_BASE_URL), coverUpdatedAt);
};

export const buildChapterAssetUrl = (path: string | null | undefined, pagesUpdatedAt?: string | number | null | undefined): string | null => {
  if (!path) {
    return null;
  }

  return appendCacheToken(buildAbsoluteUrl(path, env.CHAPTER_CDN_BASE_URL), pagesUpdatedAt);
};

export interface BuildChapterPageUrlsOptions {
  pages: number | null | undefined;
  pagesPrefix: string | null | undefined;
  pagesExt: string | null | undefined;
  pagesFilePrefix?: string | null | undefined;
  pagesUpdatedAt?: string | number | null | undefined;
}

export const normalizeChapterPageFilePrefix = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  return PAGE_FILE_PREFIX_PATTERN.test(value) ? value : "";
};

export const buildChapterPageFileName = (options: {
  pageNumber: number;
  padLength: number;
  extension: string;
  pageFilePrefix?: string | null | undefined;
}): string => {
  const safePageNumber = Math.max(1, Math.trunc(options.pageNumber));
  const safePadLength = Math.max(1, Math.trunc(options.padLength));
  const safeExtension = options.extension.trim().replace(/^\./, "");

  if (!safeExtension) {
    throw new Error("Chapter page extension is required");
  }

  const baseName = String(safePageNumber).padStart(safePadLength, "0");
  const suffix = normalizeChapterPageFilePrefix(options.pageFilePrefix);

  return suffix ? `${baseName}_${suffix}.${safeExtension}` : `${baseName}.${safeExtension}`;
};

export const buildChapterPageUrls = (options: BuildChapterPageUrlsOptions): string[] => {
  if (!options.pagesPrefix || !options.pagesExt) {
    return [];
  }

  const totalPages = options.pages ?? 0;

  if (!Number.isInteger(totalPages) || totalPages <= 0) {
    return [];
  }

  const padLength = Math.max(3, Math.min(6, String(totalPages).length));
  const normalizedPrefix = options.pagesPrefix.replace(/\/+$/, "");

  return Array.from({ length: totalPages }, (_, index) => {
    const fileName = buildChapterPageFileName({
      pageNumber: index + 1,
      padLength,
      extension: options.pagesExt ?? "",
      pageFilePrefix: options.pagesFilePrefix,
    });

    return buildChapterAssetUrl(`${normalizedPrefix}/${fileName}`, options.pagesUpdatedAt) ?? "";
  }).filter((item) => item.length > 0);
};
