import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useDealLinkOptions } from './useDealLinkOptions.js';
import { storedDealLabel } from './dealLinkModel.js';
import './deal-link.css';

function dealHint({ access, options, loading, error }, value) {
  if (access.scope === 'none')
    return value
      ? 'Only members with finance access can choose a deal. You can clear this link.'
      : 'Only members with finance access can link a deal.';
  if (error) return error;
  if (loading) return 'Loading the deals in your view…';
  if (!options.length) return 'No deals are in your view yet.';
  return 'Only deals in your view can be linked.';
}

const hintIcons = { locked: 'lock', error: 'info', loading: 'clock', info: 'info' };

function hintKind({ access, loading, error }) {
  if (access.scope === 'none') return 'locked';
  if (error) return 'error';
  return loading ? 'loading' : 'info';
}

/**
 * Connected Interaction log "Deal ID optional" (finance-design §6.3, §17). Members with finance
 * access choose from the deals they can see; others keep the stored value read-only or clear
 * it. A stored value outside the caller's choices shows "Linked deal unavailable".
 */
export function DealLinkField({ field, value, inputProps, change }) {
  const state = useDealLinkOptions();
  const { access, options, loading } = state;
  const hintId = `${field.key}-deal-hint`;
  const describedBy = [inputProps['aria-describedby'], hintId].filter(Boolean).join(' ');
  const kind = hintKind(state);
  const hint = (
    <small id={hintId} className={`field-hint deal-link-hint is-${kind}`}>
      <Icon name={hintIcons[kind]} size={14} />
      <span>{dealHint(state, value)}</span>
    </small>
  );
  if (access.scope === 'none')
    return (
      <>
        <div className="deal-link-row">
          <input
            {...inputProps}
            aria-describedby={describedBy}
            id={field.key}
            value={value ? storedDealLabel(value, false) : 'No deal linked'}
            readOnly
          />
          {value && (
            <Button
              variant="light"
              icon="close"
              aria-label="Clear deal link"
              onClick={() => change(field.key, '')}
            >
              Clear
            </Button>
          )}
        </div>
        {hint}
      </>
    );
  const known = options.some((option) => option.id === value);
  return (
    <>
      <select
        {...inputProps}
        aria-describedby={describedBy}
        aria-busy={loading || undefined}
        id={field.key}
        value={value}
        onChange={(event) => change(field.key, event.target.value)}
      >
        <option value="">No linked deal</option>
        {value && !known && <option value={value}>{storedDealLabel(value, loading)}</option>}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {hint}
    </>
  );
}
