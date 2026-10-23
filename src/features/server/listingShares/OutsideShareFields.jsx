import React, { useId } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { dubaiDay } from './listingShareLinks.js';

/**
 * The share's choices (owner 2026-10-23): the last day the agent may view the listing (today
 * to 90 days ahead, 30 by default), whether the exact location goes with it (off by
 * default) and a short note to the agent.
 */
export function OutsideShareFields({ value, onChange }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`listingShares.${key}`, vars);
  const id = useId();
  const set = (changes) => onChange({ ...value, ...changes });
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-day`}>
          {k('lastDay')}
          <span className="required"> *</span>
        </label>
        <input
          id={`${id}-day`}
          type="date"
          required
          min={dubaiDay(0)}
          max={dubaiDay(90)}
          value={value.lastDay}
          aria-describedby={`${id}-day-hint`}
          onChange={(event) => set({ lastDay: event.target.value })}
        />
        <small id={`${id}-day-hint`} className="finance-hint">
          {k('lastDayHint')}
        </small>
      </div>
      <div className="field span-all outside-share-check">
        <label>
          <input
            type="checkbox"
            checked={value.exact}
            aria-describedby={`${id}-exact-hint`}
            onChange={(event) => set({ exact: event.target.checked })}
          />
          <span>{k('exactLocation')}</span>
        </label>
        <small id={`${id}-exact-hint`} className="finance-hint">
          {k('exactLocationHint')}
        </small>
      </div>
      <div className="field span-all">
        <label htmlFor={`${id}-note`}>{k('note')}</label>
        <textarea
          id={`${id}-note`}
          rows={3}
          maxLength={500}
          value={value.note}
          aria-describedby={`${id}-note-hint`}
          onChange={(event) => set({ note: event.target.value })}
        />
        <small id={`${id}-note-hint`} className="finance-hint">
          {k('noteHint')}
        </small>
      </div>
    </>
  );
}
