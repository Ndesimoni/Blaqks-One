import React from 'react';
import { get } from '../../../lib/records.js';
import { Icon } from '../../../components/ui/Icon.jsx';
import { dubaiClock } from '../../../lib/dubaiDate.js';
import { hourMarks, minutesOf, nowPercent, startPercent, todayTimeline } from './timelineModel.js';

/** One timed block: own viewings and follow-ups open their record; held viewings never do. */
function Block({ item, clientName, propertyName, onOpen }) {
  const style = { insetInlineStart: `min(${startPercent(item.minutes)}%, calc(100% - 200px))` };
  if (item.kind === 'held') {
    const agent = item.entry.agentName ? `Booked by ${item.entry.agentName}` : 'Unassigned';
    return (
      <div className="today-block today-held" style={style}>
        <strong>
          {item.time} · {propertyName(item.entry.propertyId)}
        </strong>
        <span>
          <Icon name="lock" size={11} /> Viewing · {agent}
        </span>
      </div>
    );
  }
  const viewing = item.kind === 'viewing';
  const record = viewing ? item.entry.record : item.task;
  const title = viewing
    ? propertyName(get(record, 'Property ID'))
    : get(record, 'Next action') || 'Contact client';
  return (
    <button
      type="button"
      className={`today-block ${viewing ? 'today-viewing' : 'today-follow-up'}`}
      style={style}
      onClick={() => onOpen(viewing ? 'Viewings' : 'Follow-ups', record)}
    >
      <strong>
        {item.time} · {title}
      </strong>
      <span>
        {viewing ? 'Viewing' : 'Follow-up'} · {clientName(get(record, 'Client ID'))}
      </span>
    </button>
  );
}

/**
 * Today from 09:00 to 19:00 (Dubai time) with an amber "now" line. Untimed follow-ups due
 * today sit in their own lane. The box scrolls sideways on narrow screens.
 */
export function TodayTimeline({ viewings, dueTasks, today, clientName, propertyName, onOpen }) {
  const { timed, untimed } = todayTimeline({ viewings, dueTasks, today });
  const now = dubaiClock(new Date());
  const nowAt = nowPercent(minutesOf(now));
  if (!timed.length && !untimed.length)
    return <p className="v2-empty">Nothing is scheduled for today.</p>;
  return (
    <div className="today-scroll">
      <div className="today-track" aria-label="Today’s schedule" role="group">
        <ol className="today-hours" aria-hidden="true">
          {hourMarks.map((mark, index) => (
            <li
              key={mark}
              style={{ insetInlineStart: `${(index / (hourMarks.length - 1)) * 100}%` }}
            >
              {mark}
            </li>
          ))}
        </ol>
        {nowAt !== null && (
          <span className="today-now" style={{ insetInlineStart: `${nowAt}%` }}>
            <b>{now}</b>
          </span>
        )}
        {untimed.length > 0 && (
          <div className="today-lane today-untimed">
            <span className="v2-label">Any time today</span>
            {untimed.map((task, index) => (
              <button
                type="button"
                key={index}
                className="v2-chip v2-chip-blue"
                onClick={() => onOpen('Follow-ups', task)}
              >
                {get(task, 'Next action') || 'Contact client'}
              </button>
            ))}
          </div>
        )}
        {timed.map((item, index) => (
          <div className="today-lane" key={index}>
            <Block
              item={item}
              clientName={clientName}
              propertyName={propertyName}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
