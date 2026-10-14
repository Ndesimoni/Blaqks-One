import { add, assign, assignmentTeams } from '../api/assignment-helpers.mjs';

export { add, assign };

/**
 * A fresh Admin team with two assigned-only Property Agents (relationships, properties and
 * scheduling; no finance), created through the API so each story owns its records.
 */
export async function assignTeam(prefix) {
  const team = await assignmentTeams(prefix);
  const person = (who) => ({
    email: `${prefix}-${who}@team-fixture.test`,
    name: `Synthetic ${prefix}-${who}`,
    id: team[who].user.id,
  });
  return { ...team, people: { admin: person('admin'), one: person('one'), two: person('two') } };
}

/** Creates a record as `session` and optionally assigns it (null sends it to the queue). */
export async function held(team, collection, record, holder) {
  const entry = await add(team.admin, collection, record);
  if (holder === undefined) return entry;
  const result = await assign(team.admin, collection, entry, holder);
  if (result.status !== 200) throw Error(JSON.stringify(result.value));
  return result.value.entry || entry;
}
