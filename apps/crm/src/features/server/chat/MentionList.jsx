import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

/**
 * The colleagues to mention, above the composer (packet C3). The text field keeps focus:
 * arrows move through this list and Enter chooses; a click chooses too.
 */
export function MentionList({ id, mentions }) {
  const { t } = useI18n();
  if (!mentions.open) return null;
  return (
    <ul id={id} className="chat-mentions" role="listbox" aria-label={t('chat.mention.list')}>
      {mentions.matches.map((person, index) => (
        <li
          key={person.id}
          id={`${id}-${index}`}
          role="option"
          aria-selected={index === mentions.active}
          className={index === mentions.active ? 'is-active' : undefined}
          // Keep the cursor in the text field while choosing with the mouse.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => mentions.choose(person)}
        >
          <span className="chat-mention-avatar" aria-hidden="true">
            {initials(person.name)}
          </span>
          <span>{person.name}</span>
        </li>
      ))}
    </ul>
  );
}
