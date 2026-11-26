import React, { useId, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { SelectField } from './SelectField.jsx';
import { useSenders } from './useSenders.js';
import { availableSenders } from './whatsappModel.js';
import '../finance/finance-forms.css';

/**
 * Give a member a number (WQ3): choose a live member with the WhatsApp grant (or the Admin)
 * and an online Twilio sender that no company holds. When either list is empty the dialog
 * says why and what to do instead. `onGive` resolves to '' or the server's reason; the
 * choices are kept after a refusal.
 */
export function GiveNumberDialog({
  api,
  workspaceId,
  members,
  numbers,
  nameOf,
  t,
  onClose,
  onGive,
}) {
  const id = useId();
  const k = (key, vars) => t(`whatsappNumbers.dialog.${key}`, vars);
  const loaded = useSenders(api, workspaceId);
  const [choice, setChoice] = useState({ memberId: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const memberRef = useRef(null);
  const senderRef = useRef(null);
  const senders = loaded.senders ? availableSenders(loaded.senders, numbers) : [];
  const others = loaded.senders ? loaded.senders.length - senders.length : 0;
  const ready = Boolean(loaded.senders) && members.length > 0 && senders.length > 0;
  const pick = (key) => (value) => {
    setChoice((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
    setMessage('');
  };
  const submit = async () => {
    const problems = {
      memberId: choice.memberId ? '' : 'memberRequired',
      phone: choice.phone ? '' : 'senderRequired',
    };
    setErrors(problems);
    if (problems.memberId || problems.phone) {
      (problems.memberId ? memberRef : senderRef).current?.focus();
      return;
    }
    setBusy(true);
    setMessage('');
    const failure = await onGive(choice.memberId, choice.phone);
    setBusy(false);
    if (failure) setMessage(failure);
  };
  return (
    <FinanceDialog
      className="whatsapp-dialog"
      eyebrow={k('eyebrow')}
      title={k('title')}
      intro={k('intro')}
      busy={busy}
      message={message}
      onClose={onClose}
      onSubmit={ready ? submit : undefined}
      submitLabel={k('submit')}
      dismissLabel={ready ? t('channels.cancel') : k('close')}
    >
      {loaded.failed ? (
        <div className="whatsapp-explain" role="alert">
          <strong>{k('loadError')}</strong>
          {loaded.message && <p>{loaded.message}</p>}
          <div className="channel-actions">
            <Button variant="light" onClick={loaded.retry}>
              {k('retry')}
            </Button>
          </div>
        </div>
      ) : !loaded.senders ? (
        <p className="channels-muted" role="status">
          {k('loading')}
        </p>
      ) : members.length === 0 ? (
        <p className="whatsapp-explain">{k('noMembers')}</p>
      ) : senders.length === 0 ? (
        <div className="whatsapp-explain">
          <strong>{k('noSendersTitle')}</strong>
          <p>{k('noSenders')}</p>
          {others > 0 && <p>{k('unavailable', { count: others })}</p>}
        </div>
      ) : (
        <>
          <SelectField
            id={`${id}-member`}
            label={k('member')}
            hint={k('memberHint')}
            error={errors.memberId ? k(errors.memberId) : ''}
            value={choice.memberId}
            prompt={k('chooseMember')}
            options={members.map((member) => ({ value: member.id, label: nameOf(member.id) }))}
            selectRef={memberRef}
            onChange={pick('memberId')}
          />
          <SelectField
            id={`${id}-sender`}
            label={k('sender')}
            hint={[k('senderHint'), others > 0 ? k('unavailable', { count: others }) : '']
              .filter(Boolean)
              .join(' ')}
            error={errors.phone ? k(errors.phone) : ''}
            value={choice.phone}
            prompt={k('chooseSender')}
            options={senders.map((sender) => ({ value: sender.phone, label: sender.phone }))}
            selectRef={senderRef}
            onChange={pick('phone')}
          />
        </>
      )}
    </FinanceDialog>
  );
}
