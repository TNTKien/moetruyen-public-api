export interface PublicChapterAccessInput {
  chapterPasswordHash: string | null | undefined;
  chapterInteractionBoostEnabled?: boolean | null | undefined;
  chapterIsOneshot: boolean;
  mangaOneshotLocked: boolean;
}

export type PublicChapterAccess = "public" | "password_required" | "interaction_boost_enabled" | "locked";
export type ChapterForbiddenReason = Exclude<PublicChapterAccess, "public"> | "processing";

export const isProcessingChapterState = (processingState: string | null | undefined): boolean =>
  (processingState ?? "").trim().toLowerCase() === "processing";

export const getPublicChapterAccess = ({
  chapterPasswordHash,
  chapterInteractionBoostEnabled,
  chapterIsOneshot,
  mangaOneshotLocked,
}: PublicChapterAccessInput): PublicChapterAccess => {
  if (chapterPasswordHash) {
    return "password_required";
  }

  if (chapterInteractionBoostEnabled) {
    return "interaction_boost_enabled";
  }

  if (mangaOneshotLocked && chapterIsOneshot) {
    return "locked";
  }

  return "public";
};

export const isPublicChapterAccessible = (input: PublicChapterAccessInput): boolean =>
  getPublicChapterAccess(input) === "public";
