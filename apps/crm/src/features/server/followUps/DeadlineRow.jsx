import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { clName, get, prName } from '../../../lib/records.js';
import { RecordRowActions } from '../../records/RecordRowActions.jsx';
import { deadlineMoment } from './deadlineModel.js';

/** Read-only presentation; the existing record slider owns all edits and permission checks. */
export function DeadlineRow({ record, data, readOnly, onOpen }) {
  const { t, format } = useI18n();
  const id = String(get(record, 'Activity ID') ?? '');
  const { day, time } = deadlineMoment(get(record, 'Due date'));
  const client = get(record, 'Client ID');
  const property = get(record, 'Property ID');
  const channel = get(record, 'Channel');
  return (
    <li className="deadline-row" onClick={onOpen}>
      <div className="deadline-content">
        <p className="deadline-title">
          <strong>{get(record, 'Next action') || t('followUps.untitled')}</strong>
          <span className="deadline-id">{id}</span>
        </p>
        {(client || property) && (
          <p className="deadline-links">
            {client && <span>{clName(data, client)}</span>}
            {property && <span>{prName(data, property)}</span>}
          </p>
        )}
        <p className="deadline-meta">
          <span>
            {t('followUps.due')}:{' '}
            {day ? (
              <time dateTime={time ? `${day}T${time}+04:00` : day}>
                {format.date(day, { day: 'numeric', month: 'short', year: 'numeric' })}
                {time && ` · ${time}`}
              </time>
            ) : (
              t('followUps.missingDate')
            )}
          </span>
          {channel && <span>{channel}</span>}
          <Badge>{get(record, 'Task status') || t('followUps.noStatus')}</Badge>
        </p>
      </div>
      <div className="deadline-actions">
        <RecordRowActions
          module="Follow-ups"
          record={record}
          id={id}
          readOnly={readOnly}
          onOpen={onOpen}
        />
      </div>
    </li>
  );
}
