import type { ChapterForbiddenReason } from "./chapter-access.js";

export const getChapterForbiddenError = (reason: ChapterForbiddenReason): { code: string; message: string } => {
  switch (reason) {
    case "password_required":
      return {
        code: "PASSWORD_REQUIRED",
        message: "Password required to access this chapter",
      };
    case "interaction_boost_enabled":
      return {
        code: "INTERACTION_BOOST_REQUIRED",
        message: "Chapter requires interaction boost to access",
      };
    case "processing":
      return {
        code: "CHAPTER_PROCESSING",
        message: "Chapter is processing",
      };
    case "locked":
      return {
        code: "CHAPTER_LOCKED",
        message: "Chapter is locked",
      };
  }
};
