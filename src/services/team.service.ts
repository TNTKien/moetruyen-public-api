import { teamRepository } from "../repositories/team.repository.js";
import type { TeamListQuery, TeamMangaListQuery, TeamUpdatesQuery } from "../contracts/team.js";

export const teamService = {
  listPublicTeams(query: TeamListQuery) {
    return teamRepository.listPublicTeams(query);
  },
  getPublicTeamById(id: number) {
    return teamRepository.findPublicTeamById(id);
  },
  listPublicTeamMembersByTeamId(id: number) {
    return teamRepository.listPublicTeamMembersByTeamId(id);
  },
  listPublicTeamMangaByTeamId(id: number, query: TeamMangaListQuery) {
    return teamRepository.listPublicTeamMangaByTeamId(id, query);
  },
  listPublicTeamUpdatesByTeamId(id: number, query: TeamUpdatesQuery) {
    return teamRepository.listPublicTeamUpdatesByTeamId(id, query);
  },
};
