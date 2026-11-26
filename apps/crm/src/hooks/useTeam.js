import { useContext } from 'react';
import { TeamContext } from '../app/TeamContext.js';
export function useTeam() {
  const value = useContext(TeamContext);
  if (!value) throw Error('useTeam must be used within TeamProvider.');
  return value;
}
