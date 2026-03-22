export interface PublicChapterAccessInput {
  chapterPasswordHash: string | null | undefined;
  chapterIsOneshot: boolean;
  mangaOneshotLocked: boolean;
}

export type PublicChapterAccess = "public" | "password_required" | "locked";

export const getPublicChapterAccess = ({
  chapterPasswordHash,
  chapterIsOneshot,
  mangaOneshotLocked,
}: PublicChapterAccessInput): PublicChapterAccess => {
  if (chapterPasswordHash) {
    return "password_required";
  }

  if (mangaOneshotLocked && chapterIsOneshot) {
    return "locked";
  }

  return "public";
};

export const isPublicChapterAccessible = (input: PublicChapterAccessInput): boolean =>
  getPublicChapterAccess(input) === "public";
