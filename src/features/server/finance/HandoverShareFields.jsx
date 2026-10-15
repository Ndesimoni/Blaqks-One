import React from 'react';
import { formatPercent } from '../../../lib/finance/money.js';

/** One option card: a native radio with a title and a short explanation. */
function Option({ name, value, checked, disabled, title, detail, onChange }) {
  return (
    <label className="deal-option" data-checked={checked} data-disabled={disabled}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="deal-option-text">
        <span className="deal-option-title">{title}</span>
        <small>{detail}</small>
      </span>
    </label>
  );
}

/**
 * "What you keep" for a hand-over offer (finance-design §13 H-F1): a full hand-over, or a
 * referral share taken from the receiver's share. The team's cap shows when the caller can
 * see it; otherwise the server checks it. A referral needs an unearned deal with no second
 * agent.
 */
export function HandoverShareFields({ id, keep, setMode, share, setShare, allowed, cap, error }) {
  const limit = cap !== null && cap !== undefined;
  return (
    <>
      <fieldset className="deal-options">
        <legend>What you keep</legend>
        <Option
          name={`${id}-mode`}
          value="full"
          checked={!keep}
          title="Hand over fully"
          detail="Your teammate takes the whole deal and its commission."
          onChange={() => setMode('full')}
        />
        <Option
          name={`${id}-mode`}
          value="referral"
          checked={keep}
          disabled={!allowed}
          title="Keep a referral share"
          detail={
            allowed
              ? `You stay on the deal as second agent${limit ? `, up to ${formatPercent(cap)}` : ''}.`
              : 'Only on deals that are not earned and have no second agent.'
          }
          onChange={() => setMode('referral')}
        />
      </fieldset>
      {keep && (
        <div className="field">
          <label htmlFor={`${id}-share`}>
            Referral share %<span className="required"> *</span>
          </label>
          <input
            id={`${id}-share`}
            inputMode="decimal"
            value={share}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-share-hint${error ? ` ${id}-share-error` : ''}`}
            onChange={(event) => setShare(event.target.value)}
          />
          <small id={`${id}-share-hint`} className="finance-hint">
            Taken from the receiving agent's share.{' '}
            {limit ? `Your team's limit is ${formatPercent(cap)}.` : "Your team's limit applies."}
          </small>
          {error && (
            <p id={`${id}-share-error`} className="field-error">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
