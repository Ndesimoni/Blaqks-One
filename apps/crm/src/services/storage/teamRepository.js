import { TEAM_STORAGE } from '../../config/team.js';
import { initialTeam, validateTeam } from '../../features/team/model.js';

export function createTeamRepository(getStorage = () => globalThis.localStorage) {
  return {
    read() {
      let raw = null;
      try {
        raw = getStorage().getItem(TEAM_STORAGE);
        return {
          team: raw === null ? initialTeam() : validateTeam(JSON.parse(raw)),
          error: '',
          raw,
        };
      } catch {
        return {
          team: initialTeam(),
          error: 'The saved team preview could not be opened. Your saved data has been preserved.',
          raw,
        };
      }
    },
    save(team) {
      const normalized = validateTeam(team);
      getStorage().setItem(TEAM_STORAGE, JSON.stringify(normalized));
      return normalized;
    },
  };
}
export const teamRepository = createTeamRepository();
