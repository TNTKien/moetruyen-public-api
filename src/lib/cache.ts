export const CACHE_CONTROL = {
  mangaList: "public, max-age=30, stale-while-revalidate=120",
  mangaDetail: "public, max-age=60, stale-while-revalidate=300",
  mangaChapters: "public, max-age=30, stale-while-revalidate=120",
  search: "no-store",
} as const;
