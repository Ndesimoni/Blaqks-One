import { readFacts } from './requestsModel.js';

/**
 * A request row's shared facts for display, or null when the row is not one the board would
 * show. Used for rows that arrive outside the strict board and My requests readers, such as
 * the Updates list, so a malformed row only loses its title, never the screen.
 */
export function readSummary(value) {
  try {
    return readFacts(value);
  } catch {
    return null;
  }
}
