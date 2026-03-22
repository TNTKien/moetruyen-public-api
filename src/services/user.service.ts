import type { UserCommentsQuery } from "../contracts/user.js";
import { userRepository } from "../repositories/user.repository.js";

export const userService = {
  getPublicUserByUsername(username: string) {
    return userRepository.findPublicUserByUsername(username);
  },
  listPublicUserCommentsByUsername(username: string, query: UserCommentsQuery) {
    return userRepository.listPublicUserCommentsByUsername(username, query);
  },
};
