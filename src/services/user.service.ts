import { userRepository } from "../repositories/user.repository.js";

export const userService = {
  getPublicUserByUsername(username: string) {
    return userRepository.findPublicUserByUsername(username);
  },
};
