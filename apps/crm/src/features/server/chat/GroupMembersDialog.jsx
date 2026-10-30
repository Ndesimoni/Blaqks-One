import React, { useId, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { GroupMemberPicker } from './GroupMemberPicker.jsx';
import { matchPeople } from './chatModel.js';

const LIMIT = 21;

/** Adds colleagues to a private group after an explicit full-history confirmation. */
export function GroupMembersDialog({ room, title, people, user, onAdd, onClose }) {
  const { t } = useI18n();
  const titleId = useId();
  const confirmRef = useRef(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = room.members ?? [];
  const remaining = Math.max(0, LIMIT - current.length);
  const available = matchPeople(
    people.filter((person) => !current.includes(person.id)),
    query,
  );
  const existing = [user, ...people].filter((person) => current.includes(person.id));
  const toggle = (id) =>
    setChosen((items) =>
      items.includes(id) ? items.filter((item) => item !== id) : [...items, id],
    );
  const review = (event) => {
    event.preventDefault();
    setConfirming(true);
    requestAnimationFrame(() => confirmRef.current?.focus());
  };
  const submit = async () => {
    setBusy(true);
    setError('');
    const failure = await onAdd(chosen);
    setBusy(false);
    if (failure) setError(t('chat.group.addFailed', { reason: failure }));
    else onClose();
  };
  const close = () => !busy && onClose();
  const selected = people.filter((person) => chosen.includes(person.id));
  return (
    <Drawer titleId={titleId} className="chat-members-dialog" onClose={close}>
      <form className="drawer-form" onSubmit={review}>
        <div className="drawer-top">
          <div>
            <h2 id={titleId}>{t('chat.group.add')}</h2>
            <p>{t('chat.group.capacity', { count: current.length, title })}</p>
          </div>
          <Button variant="light" disabled={busy} onClick={close}>
            {t('chat.cancel')}
          </Button>
        </div>
        <div className="drawer-body">
          {confirming ? (
            <section className="chat-members-confirm">
              <h3 ref={confirmRef} tabIndex="-1">
                {t('chat.group.addConfirm', { count: chosen.length })}
              </h3>
              <ul>
                {selected.map((person) => (
                  <li key={person.id}>{person.name}</li>
                ))}
              </ul>
              <p>{t('chat.group.historyWarning')}</p>
            </section>
          ) : (
            <GroupMemberPicker
              searchId={`${titleId}-search`}
              query={query}
              setQuery={setQuery}
              available={available}
              chosen={chosen}
              remaining={remaining}
              toggle={toggle}
              existing={existing}
              formerCount={current.length - existing.length}
              userId={user.id}
            />
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="drawer-footer">
          <span aria-live="polite">
            {t('chat.group.selected', {
              count: chosen.length,
              remaining: remaining - chosen.length,
            })}
          </span>
          {confirming ? (
            <Button variant="light" disabled={busy} onClick={() => setConfirming(false)}>
              {t('chat.group.back')}
            </Button>
          ) : (
            <Button variant="light" onClick={close}>
              {t('chat.cancel')}
            </Button>
          )}
          <Button
            type={confirming ? 'button' : 'submit'}
            disabled={busy || chosen.length === 0}
            onClick={confirming ? submit : undefined}
          >
            {t(
              busy
                ? 'chat.group.adding'
                : confirming
                  ? 'chat.group.addCount'
                  : 'chat.group.continue',
              { count: chosen.length },
            )}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
