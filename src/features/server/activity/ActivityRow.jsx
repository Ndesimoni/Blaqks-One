import React, { useId, useState } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { avatarTone } from '../profile/profileModel.js';
import { describe, initials, timeLabel, UNAVAILABLE } from './activityModel.js';
import { repeatCount } from './activityGrouping.js';

/** The row's time: one entry's time, or the oldest–newest range of a repeated action. */
function RowTime({ row }) {
  const newest = row.items[0].at;
  const oldest = row.items.at(-1).at;
  if (timeLabel(oldest) === timeLabel(newest))
    return (
      <time className="activity-time" dateTime={newest}>
        {timeLabel(newest)}
      </time>
    );
  return (
    <span className="activity-time">
      <time dateTime={oldest}>{timeLabel(oldest)}</time>–
      <time dateTime={newest}>{timeLabel(newest)}</time>
    </span>
  );
}

/** Each time a repeated action was recorded, newest first. */
function RepeatTimes({ id, row, open }) {
  return (
    <ul id={id} className="activity-repeat-times" aria-label="Times recorded" hidden={!open}>
      {row.items.map((entry) => (
        <li key={entry.id}>
          <time dateTime={entry.at}>{timeLabel(entry.at)}</time>
        </li>
      ))}
    </ul>
  );
}

/**
 * One row: who, what, which record (or Record unavailable), section, time and Sample. Repeats
 * of the same action read "· 7 times" with a disclosure listing each time.
 */
export function ActivityRow({ row, userId, entries }) {
  const { item } = row;
  const id = useId();
  const [open, setOpen] = useState(false);
  const text = describe(item, { userId, entries });
  const unavailable = item.kind === 'record' && text.object === null;
  const repeated = row.items.length > 1;
  return (
    <li className={'activity-row' + (repeated ? ' is-repeated' : '')}>
      <span className="activity-avatar" data-tone={avatarTone(item.actor.id)} aria-hidden="true">
        {initials(item.actor.name)}
        <span className={`activity-action-badge is-${text.tone}`}>
          <Icon name={text.icon} size={11} strokeWidth={2.4} />
        </span>
      </span>
      <div className="activity-body">
        <p className="activity-phrase">
          <strong>{text.actor}</strong> {text.verb}
          {text.noun && ` ${text.noun}`}
          {text.object && (
            <>
              {' '}
              <strong className="activity-object">{text.object}</strong>
            </>
          )}
          {unavailable && (
            <span className="activity-unavailable">
              <Icon name="lock" size={12} />
              {UNAVAILABLE}
            </span>
          )}
          {repeated && (
            <span className="activity-repeat-count"> · {repeatCount(row.items.length)}</span>
          )}
        </p>
        <p className="activity-meta">
          <span className="activity-section">
            <Icon name={text.sectionIcon || 'shield'} size={13} />
            {text.section}
          </span>
          {item.sample && <span className="activity-sample">Sample</span>}
          {repeated && (
            <button
              type="button"
              className="activity-repeat-toggle"
              aria-expanded={open}
              aria-controls={`${id}-times`}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? 'Hide times' : 'Show times'}
              <Icon name="down" size={13} />
            </button>
          )}
          <RowTime row={row} />
        </p>
        {repeated && <RepeatTimes id={`${id}-times`} row={row} open={open} />}
      </div>
    </li>
  );
}
