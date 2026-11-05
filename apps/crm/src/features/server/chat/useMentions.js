import { useMemo, useState } from 'react';
import { insertMention, keptMentions, matchMentions, mentionQuery } from './mentionModel.js';

/**
 * The `@` suggestions of one composer (packet C3). They open while an `@search` before the
 * caret matches a colleague who can see the room: arrows move, Enter or Tab chooses, Escape
 * closes. Chosen colleagues travel as IDs while their `@Name` stays in the text. With no
 * `people` (direct conversations) nothing opens.
 */
export function useMentions(people, text, setText, field) {
  const [search, setSearch] = useState(null);
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState([]);
  const [dismissed, setDismissed] = useState(-1);
  const matches = useMemo(
    () => (search ? matchMentions(people, search.query) : []),
    [people, search],
  );
  const open = matches.length > 0;
  const track = (value, caret) => {
    const next = people.length ? mentionQuery(value, caret) : null;
    const shown = next && next.start !== dismissed ? next : null;
    if (shown?.query !== search?.query || shown?.start !== search?.start) setActive(0);
    setSearch(shown);
  };
  const choose = (person) => {
    if (!search) return;
    const result = insertMention(text, search, person.name);
    setText(result.text);
    setChosen((current) => [...current.filter((item) => item.id !== person.id), person]);
    // The finished `@Name` still looks like a search: keep it closed.
    setDismissed(search.start);
    setSearch(null);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(result.caret, result.caret);
    });
  };
  const onKeyDown = (event) => {
    if (!open) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + matches.length) % matches.length);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      choose(matches[Math.min(active, matches.length - 1)]);
    } else if (event.key === 'Escape') {
      setDismissed(search.start);
      setSearch(null);
    } else return false;
    event.preventDefault();
    return true;
  };
  return {
    open,
    matches,
    active: Math.min(active, Math.max(matches.length - 1, 0)),
    choose,
    track,
    onKeyDown,
    close: () => setSearch(null),
    ids: () => keptMentions(text, chosen),
    reset: () => {
      setChosen([]);
      setSearch(null);
      setDismissed(-1);
    },
  };
}
