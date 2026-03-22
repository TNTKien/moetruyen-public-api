export const CACHE_CONTROL = {
  genres: "public, max-age=300, stale-while-revalidate=600",
  mangaList: "public, max-age=30, stale-while-revalidate=120",
  mangaDetail: "public, max-age=60, stale-while-revalidate=300",
  mangaChapters: "public, max-age=30, stale-while-revalidate=120",
  teamDetail: "public, max-age=60, stale-while-revalidate=300",
  teamMangaList: "public, max-age=30, stale-while-revalidate=120",
  teamMembers: "public, max-age=60, stale-while-revalidate=300",
  teamUpdates: "public, max-age=30, stale-while-revalidate=120",
  userDetail: "public, max-age=60, stale-while-revalidate=300",
  userComments: "public, max-age=30, stale-while-revalidate=120",
  search: "no-store",
} as const;
