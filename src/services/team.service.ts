import { teamRepository } from "../repositories/team.repository.js";
import type { TeamMangaListQuery } from "../contracts/team.js";

export const teamService = {
  getPublicTeamById(id: number) {
    return teamRepository.findPublicTeamById(id);
  },
  listPublicTeamMembersByTeamId(id: number) {
    return teamRepository.listPublicTeamMembersByTeamId(id);
  },
  listPublicTeamMangaByTeamId(id: number, query: TeamMangaListQuery) {
    return teamRepository.listPublicTeamMangaByTeamId(id, query);
  },
};
