export const CACHE_CONTROL = {
  genres: "public, max-age=300, stale-while-revalidate=600",
  mangaList: "public, max-age=30, stale-while-revalidate=120",
  mangaDetail: "public, max-age=60, stale-while-revalidate=300",
  mangaChapters: "public, max-age=30, stale-while-revalidate=120",
  search: "no-store",
} as const;
