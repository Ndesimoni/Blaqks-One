import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/** Searchable available/current member lists inside the access-expansion dialog. */
export function GroupMemberPicker({
  searchId,
  query,
  setQuery,
  available,
  chosen,
  remaining,
  toggle,
  existing,
  formerCount,
  userId,
}) {
  const { t } = useI18n();
  return (
    <>
      <p className="chat-members-warning">{t('chat.group.historyWarning')}</p>
      <label htmlFor={searchId}>{t('chat.group.search')}</label>
      <input
        id={searchId}
        type="search"
        data-initial-focus
        value={query}
        onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
        onChange={(event) => setQuery(event.target.value)}
      />
      <fieldset className="chat-pick">
        <legend>{t('chat.group.available')}</legend>
        {remaining === 0 && <p className="chat-muted">{t('chat.group.full')}</p>}
        {remaining > 0 && available.length === 0 && (
          <p className="chat-muted">
            {t(query ? 'chat.group.noMatch' : 'chat.group.everyoneAdded')}
          </p>
        )}
        <ul className="chat-people">
          {available.map((person) => {
            const checked = chosen.includes(person.id);
            return (
              <li key={person.id}>
                <label className={'chat-pick-person' + (checked ? ' is-chosen' : '')}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && chosen.length >= remaining}
                    onChange={() => toggle(person.id)}
                  />
                  <span>{person.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div className="chat-current-members">
        <strong>{t('chat.group.already')}</strong>
        <p>
          {existing
            .map((person) => (person.id === userId ? t('chat.you') : person.name))
            .join(', ')}
        </p>
        {formerCount > 0 && <p>{t('chat.formerMember')}</p>}
      </div>
    </>
  );
}
