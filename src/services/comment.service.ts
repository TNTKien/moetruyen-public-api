import type { CommentListQuery } from "../contracts/comment.js";
import { commentRepository } from "../repositories/comment.repository.js";

export const commentService = {
  listRecentPublicComments(query: CommentListQuery) {
    return commentRepository.listRecentPublicComments(query);
  },

  listPublicMangaCommentsByMangaId(mangaId: number, query: CommentListQuery) {
    return commentRepository.listPublicMangaCommentsByMangaId(mangaId, query);
  },

  listPublicChapterCommentsByChapterId(chapterId: number, query: CommentListQuery) {
    return commentRepository.listPublicChapterCommentsByChapterId(chapterId, query);
  },
};
