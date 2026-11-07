import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { clientName, nextStage } from './clientsModel.js';

/**
 * Manage's actions in the client slider's header: Archive (an icon), Assign, Edit and Move to
 * the next stage as the one primary (Edit takes it at Customer and Lost). Assign and Archive
 * ask in place, replacing the row until chosen or cancelled; focus moves into the question
 * and returns to the button that asked after Cancel or Keep.
 */
export function ClientActions({ client, owners, one, onEdit, onToast, onClose }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const [mode, setMode] = useState('');
  const [ownerId, setOwnerId] = useState(client.ownerId);
  const box = useRef(null);
  const asked = useRef('');
  useEffect(() => {
    // Into the question, then back to the button that asked it.
    if (mode) box.current?.querySelector('button, select')?.focus();
    else if (asked.current) box.current?.querySelector(`[data-asks="${asked.current}"]`)?.focus();
    asked.current = mode;
  }, [mode]);
  const name = clientName(client);
  const next = nextStage(client.stage);
  const busy = Boolean(one.busy);
  const move = async () => {
    const outcome = await one.update({ stage: next }, 'move');
    if (outcome.ok) onToast(k('moved', { name, stage: k(`stage.${next}`) }));
  };
  const assign = async (event) => {
    event.preventDefault();
    const outcome = await one.update({ ownerId: ownerId || null }, 'assign');
    if (!outcome.ok) return;
    setMode('');
    const owner = owners.find((person) => person.id === ownerId)?.name;
    onToast(owner ? k('assignedTo', { name, owner }) : k('unassignedToast', { name }));
  };
  const archive = async () => {
    const outcome = await one.archive();
    if (!outcome.ok) return setMode('');
    onToast(k('archived', { name }));
    onClose();
  };
  if (mode === 'archive')
    return (
      <div
        ref={box}
        className="drawer-footer platform-client-ask"
        role="group"
        aria-label={k('archive')}
      >
        <p>{k('archiveAsk', { name })}</p>
        <Button variant="light" disabled={busy} onClick={() => setMode('')}>
          {k('keep')}
        </Button>
        <Button variant="danger-light" icon="trash" disabled={busy} onClick={archive}>
          {one.busy === 'archive' ? k('archiving') : k('archiveConfirm')}
        </Button>
      </div>
    );
  if (mode === 'assign')
    return (
      <form
        ref={box}
        className="drawer-footer platform-client-ask"
        aria-label={k('assign')}
        onSubmit={assign}
      >
        <label className="grid-pill-filter">
          <span>{k('assignTo')}</span>
          <select
            value={ownerId}
            disabled={busy}
            onChange={(event) => setOwnerId(event.target.value)}
          >
            <option value="">{k('nobody')}</option>
            {owners.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <Button variant="light" disabled={busy} onClick={() => setMode('')}>
          {k('cancel')}
        </Button>
        <Button type="submit" icon="check" disabled={busy}>
          {one.busy === 'assign' ? k('saving') : k('save')}
        </Button>
      </form>
    );
  return (
    <div ref={box} className="drawer-footer" role="group" aria-label={k('actions')}>
      <Button
        variant="danger-light"
        className="record-icon-action"
        icon="trash"
        title={k('archive')}
        data-asks="archive"
        disabled={busy}
        onClick={() => setMode('archive')}
      >
        {k('archive')}
      </Button>
      <Button
        variant="light"
        icon="person"
        data-asks="assign"
        disabled={busy}
        onClick={() => {
          setOwnerId(client.ownerId);
          setMode('assign');
        }}
      >
        {k('assign')}
      </Button>
      <Button variant={next ? 'light' : 'primary'} icon="edit" disabled={busy} onClick={onEdit}>
        {k('edit')}
      </Button>
      {next && (
        <Button icon="arrow" disabled={busy} onClick={move}>
          {one.busy === 'move' ? k('moving') : k('moveTo', { stage: k(`stage.${next}`) })}
        </Button>
      )}
    </div>
  );
}
