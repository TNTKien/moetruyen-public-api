export interface PublicChapterAccessInput {
  chapterPasswordHash: string | null | undefined;
  chapterIsOneshot: boolean;
  mangaOneshotLocked: boolean;
}

export const isPublicChapterAccessible = ({
  chapterPasswordHash,
  chapterIsOneshot,
  mangaOneshotLocked,
}: PublicChapterAccessInput): boolean => {
  if (chapterPasswordHash) {
    return false;
  }

  if (mangaOneshotLocked && chapterIsOneshot) {
    return false;
  }

  return true;
};

export const filterAccessibleChapters = <T extends { passwordHash: string | null | undefined; isOneshot: boolean }>(
  chapterItems: T[],
  mangaOneshotLocked: boolean,
): T[] =>
  chapterItems.filter((chapterItem) =>
    isPublicChapterAccessible({
      chapterPasswordHash: chapterItem.passwordHash,
      chapterIsOneshot: chapterItem.isOneshot,
      mangaOneshotLocked,
    }),
  );
