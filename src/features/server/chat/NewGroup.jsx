import React, { useId, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { matchPeople } from './chatModel.js';

const MIN = 2;
const MAX = 20;

/**
 * A new private group (packet C3): an optional name and 2–20 colleagues; the creator joins
 * too. Only the group's members can read it.
 */
export function NewGroup({ people, onCreate, onCancel }) {
  const { t } = useI18n();
  const id = useId();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matches = useMemo(() => matchPeople(people, search), [people, search]);
  const ready = chosen.length >= MIN && chosen.length <= MAX;
  const toggle = (person) =>
    setChosen((current) =>
      current.includes(person) ? current.filter((item) => item !== person) : [...current, person],
    );
  const submit = async (event) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    const failure = await onCreate(chosen, name.trim());
    setBusy(false);
    setError(failure ? t('chat.failed', { reason: failure }) : '');
  };
  return (
    <form
      className="chat-new chat-new-group"
      onSubmit={submit}
      onKeyDown={(event) => event.key === 'Escape' && onCancel()}
    >
      <div className="chat-new-head">
        <strong>{t('chat.newGroup')}</strong>
        <Button variant="light" onClick={onCancel}>
          {t('chat.cancel')}
        </Button>
      </div>
      <label htmlFor={`${id}-name`}>{t('chat.group.name')}</label>
      <input
        id={`${id}-name`}
        value={name}
        maxLength={60}
        autoFocus
        placeholder={t('chat.group.namePlaceholder')}
        onChange={(event) => setName(event.target.value)}
      />
      <label htmlFor={`${id}-search`}>{t('chat.direct.search')}</label>
      <input
        id={`${id}-search`}
        type="search"
        value={search}
        maxLength={80}
        onChange={(event) => setSearch(event.target.value)}
      />
      <fieldset className="chat-pick">
        <legend>{t('chat.group.members')}</legend>
        {matches.length === 0 ? (
          <p className="chat-muted">{t('chat.direct.none')}</p>
        ) : (
          <ul className="chat-people">
            {matches.map((person) => {
              const checked = chosen.includes(person.id);
              return (
                <li key={person.id}>
                  <label className={'chat-pick-person' + (checked ? ' is-chosen' : '')}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && chosen.length >= MAX}
                      onChange={() => toggle(person.id)}
                    />
                    <span>{person.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>
      <p className="chat-pick-count" aria-live="polite">
        {t('chat.group.count', { count: chosen.length })}
      </p>
      <Button type="submit" disabled={busy || !ready}>
        {t('chat.group.create')}
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
