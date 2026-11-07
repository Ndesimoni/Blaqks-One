import React, { useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { clName, get, isDone, prName } from '../../../lib/records.js';
import '../../records/grid/grid-open.css';
import { deadlineWhen } from './deadlineModel.js';

/** The right-hand time, as the mockup shows it: 10:30, Yesterday, Tue, or 12 Nov. */
function When({ when }) {
  const { t, format } = useI18n();
  if (when.kind === 'none') return t('followUps.noDate');
  if (when.kind === 'time') return when.time;
  if (when.kind === 'today') return t('followUps.today');
  const day =
    when.kind === 'yesterday'
      ? t('followUps.yesterday')
      : format.date(
          when.day,
          when.kind === 'weekday' ? { weekday: 'short' } : { day: 'numeric', month: 'short' },
        );
  return when.time ? `${day} ${when.time}` : day;
}

/**
 * One follow-up as the mockup's task row: the Done checkbox, the bold next action (it opens the
 * record) · client · property · channel, and the time on the right. A status other than Open
 * stays as a badge. The record slider owns every other edit and permission check.
 */
export function DeadlineRow({ record, data, today, done, onOpen }) {
  const { t } = useI18n();
  // The tick shows at once; the saved record (or a refusal) settles it.
  const [ticking, setTicking] = useState(null);
  const id = String(get(record, 'Activity ID') ?? '');
  const title = get(record, 'Next action') || t('followUps.untitled');
  const status = get(record, 'Task status');
  const closed = isDone(status);
  const client = get(record, 'Client ID');
  const property = get(record, 'Property ID');
  const details = [
    client && clName(data, client),
    property && prName(data, property),
    get(record, 'Channel'),
  ].filter(Boolean);
  return (
    <li className={'deadline-row' + (closed ? ' is-done' : '')} onClick={onOpen}>
      <input
        type="checkbox"
        className="deadline-done"
        aria-label={t('followUps.done', { title })}
        checked={ticking ?? closed}
        disabled={!done.allowed || done.busy}
        onClick={(event) => event.stopPropagation()}
        onChange={async (event) => {
          const next = event.target.checked;
          setTicking(next);
          await done.toggle(record, next);
          setTicking(null);
        }}
      />
      <p className="deadline-line">
        <button
          type="button"
          className="grid-open"
          aria-label={t('recordGrid.openNamed', { name: title, id })}
        >
          <strong>{title}</strong>
        </button>
        {details.map((detail) => (
          <span key={detail} className="deadline-detail">
            {' · '}
            {detail}
          </span>
        ))}
        {status && status !== 'Open' && <Badge>{status}</Badge>}
      </p>
      <span className="deadline-when">
        <When when={deadlineWhen(record, today)} />
      </span>
    </li>
  );
}
