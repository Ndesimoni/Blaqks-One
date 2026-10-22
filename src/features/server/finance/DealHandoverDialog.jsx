import React, { useId, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { parsePercent } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog } from './FinanceDialog.jsx';
import { DealRecord } from './DealRecord.jsx';
import { HandoverShareFields } from './HandoverShareFields.jsx';

/**
 * The holder offers their deal to a teammate (finance-design §13 H-F1): fully, or keeping a
 * referral share that becomes a second-agent line from the receiver's share. Nothing moves
 * until the receiver accepts; the team's referral limit is checked by the server. Only
 * staff with Finance can receive a deal; offers to other companies are made in Agreements.
 */
export function DealHandoverDialog({ deal, onClose, onDone }) {
  const { actions, assignees, user, team, overview } = useFinanceContext();
  const { t } = useI18n();
  const id = useId();
  const [toId, setToId] = useState('');
  const [mode, setMode] = useState('full');
  const [share, setShare] = useState('');
  const [message, setMessage] = useState('');
  const referralAllowed = !deal.earnedOn && !deal.secondAgent;
  const cap = team ? overview.settings?.maxReferralShareBp : null;
  const parsed = parsePercent(share);
  const keep = mode === 'referral';
  const shareError =
    keep && (parsed.error || (parsed.value === null ? 'Enter the referral share.' : ''));
  const overCap = keep && cap !== null && cap !== undefined && parsed.value > cap;
  const people = assignees.people.filter(
    (person) => person.kind === 'staff' && person.id !== user.id,
  );
  const receiver = people.find((person) => person.id === toId);
  const submit = async () => {
    setMessage('');
    const result = await actions.requestHandover(deal, toId, keep ? parsed.value : null);
    if (result.ok) return onDone();
    setMessage(failureText(result));
  };
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${deal.dealId}`}
      title="Hand over deal"
      intro="The deal moves only after your teammate accepts. You can cancel the request until then."
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Send hand-over request"
      submitDisabled={!toId || Boolean(shareError) || overCap}
    >
      <DealRecord deal={deal} />
      {assignees.error && (
        <p className="field-error" role="alert">
          {assignees.error}
        </p>
      )}
      <div className="field">
        <label htmlFor={`${id}-to`}>
          Hand over to<span className="required"> *</span>
        </label>
        <select
          id={`${id}-to`}
          value={toId}
          disabled={assignees.loading}
          onChange={(event) => {
            setToId(event.target.value);
            setMessage('');
          }}
        >
          <option value="">
            {assignees.loading ? 'Loading team members…' : 'Choose a teammate'}
          </option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        {!assignees.loading && !assignees.error && !people.length && (
          <p className="field-error" role="alert">
            {t('handoverOffer.noTeammates')}
          </p>
        )}
        <small className="finance-hint">{t('handoverOffer.otherCompany')}</small>
      </div>
      <HandoverShareFields
        id={id}
        keep={keep}
        setMode={setMode}
        share={share}
        setShare={(value) => {
          setShare(value);
          setMessage('');
        }}
        allowed={referralAllowed}
        cap={cap}
        error={shareError || (overCap ? "The referral share is above your team's limit." : '')}
      />
      {receiver && (
        <p className="finance-note deal-handover-outcome" role="note">
          After {receiver.name} accepts, they hold the deal
          {team ? '' : ' and it leaves your list'}
          {keep ? '. Your referral share appears in your commission statement once earned.' : '.'}
        </p>
      )}
    </FinanceDialog>
  );
}
