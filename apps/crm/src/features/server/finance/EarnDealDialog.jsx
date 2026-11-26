import React, { useId, useMemo, useState } from 'react';
import { readableDate } from '../../../lib/dates.js';
import { formatPercent } from '../../../lib/finance/money.js';
import { useFinanceContext, useEarnPreview } from './useFinanceRequests.js';
import { failureText, FinanceDialog } from './FinanceDialog.jsx';
import { DealCalculationPanel } from './DealCalculationPanel.jsx';
import { splitSourceLabels } from './financeLabels.js';
import { dubaiToday, earnDateLimits } from './dealEstimate.js';
import { DealRecord } from './DealRecord.jsx';

/**
 * Mark a deal earned (finance-design §13 M-F2). The confirmation shows what the server would
 * record on the chosen date — agreement, split source, lines and warnings — from the
 * earn preview. Staff approvers may choose only the last 31 days; nothing is future-dated.
 */
export function EarnDealDialog({ deal, onClose, onDone }) {
  const { api, workspaceId, access, actions, team, overview } = useFinanceContext();
  const id = useId();
  const limits = useMemo(() => earnDateLimits(access, dubaiToday()), [access]);
  const [earnedOn, setEarnedOn] = useState(limits.max);
  const [message, setMessage] = useState('');
  const inRange = earnedOn >= limits.min && earnedOn <= limits.max;
  const preview = useEarnPreview(api, workspaceId, access, deal, inRange ? earnedOn : '');
  const details = preview.value;
  const submit = async () => {
    setMessage('');
    const result = await actions.earnDeal(deal, earnedOn);
    if (result.ok) return onDone();
    setMessage(failureText(result));
  };
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${deal.dealId}`}
      title="Mark deal earned"
      intro="Earning fixes the commission split. Later changes need an Admin revision."
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Confirm earned"
      submitDisabled={!inRange || !details}
      wide
    >
      <DealRecord deal={deal} />
      {!overview.settings && (
        <p className="finance-note" role="note">
          Set up your team's commission split before marking deals earned.
        </p>
      )}
      <div className="field">
        <label htmlFor={`${id}-date`}>
          Earned date<span className="required"> *</span>
        </label>
        <input
          id={`${id}-date`}
          type="date"
          value={earnedOn}
          min={limits.min}
          max={limits.max}
          required
          aria-invalid={!inRange}
          aria-describedby={`${id}-date-hint`}
          onChange={(event) => setEarnedOn(event.target.value)}
        />
        <small id={`${id}-date-hint`} className="finance-hint">
          {access.manage
            ? 'Up to today.'
            : 'Within the last 31 days and not before the deal was created. Earlier dates need your Admin.'}
        </small>
        {!inRange && (
          <p className="field-error">
            Choose a date between {readableDate(limits.min)} and {readableDate(limits.max)}.
          </p>
        )}
      </div>
      {preview.loading && (
        <p className="finance-status" role="status">
          Checking what will be recorded…
        </p>
      )}
      {preview.error && (
        <p className="field-error" role="alert">
          {preview.error}
        </p>
      )}
      {details && (
        <div className="finance-earn-preview" aria-live="polite">
          <dl className="finance-facts">
            <div className="finance-fact">
              <dt>Agreement</dt>
              <dd>
                {details.agreement
                  ? `${formatPercent(details.agreement.agentShareBp)} agent share`
                  : 'No agreement in force'}
              </dd>
            </div>
            <div className="finance-fact">
              <dt>Split source</dt>
              <dd>
                {team && details.calculation?.splitSource
                  ? splitSourceLabels[details.calculation.splitSource]
                  : details.calculation?.adjusted
                    ? 'Adjusted by Admin'
                    : '—'}
              </dd>
            </div>
          </dl>
          {details.warnings.map((warning) => (
            <p key={warning} className="finance-note warning" role="note">
              {warning}
            </p>
          ))}
          <DealCalculationPanel
            title="Will be recorded"
            calculation={details.calculation}
            chip={`Earned on ${readableDate(details.earnedOn)}`}
            team={team}
            override={deal.override}
            secondAgent={deal.secondAgent}
          />
        </div>
      )}
    </FinanceDialog>
  );
}
