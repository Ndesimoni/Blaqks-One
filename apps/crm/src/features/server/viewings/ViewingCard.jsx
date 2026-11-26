import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { clName, get, prName } from '../../../lib/records.js';
import { RecordRowActions } from '../../records/RecordRowActions.jsx';
import { viewingMoment } from './weekModel.js';

/** The normal record slider owns editing, versions and authorization; cards never mutate records. */
export function ViewingCard({ record }) {
  const { t } = useI18n();
  const { data } = useRecords();
  const { dispatchRow, readOnly = false } = useWorkspaceActions();
  const { day, time } = viewingMoment(get(record, 'Appointment date & time'));
  const id = String(get(record, 'Viewing ID') ?? '');
  const client = get(record, 'Client ID');
  const property = get(record, 'Property ID');
  const onOpen = () => dispatchRow('Viewings', record);
  return (
    <li className="viewing-week-card" onClick={onOpen}>
      <div className="viewing-week-content">
        <p className="viewing-week-time">
          <span className="sr-only">{t('viewings.appointment')}: </span>
          {day ? (
            time ? (
              <time dateTime={`${day}T${time}+04:00`}>{time}</time>
            ) : (
              t('viewings.timeMissing')
            )
          ) : (
            t('viewings.noDate')
          )}
        </p>
        <strong>{client ? clName(data, client) : t('viewings.untitled')}</strong>
        {property && <p>{prName(data, property)}</p>}
        <p className="viewing-week-id">{id}</p>
        <Badge>{get(record, 'Viewing status') || t('viewings.noStatus')}</Badge>
      </div>
      <div className="viewing-week-actions">
        <RecordRowActions
          module="Viewings"
          record={record}
          id={id}
          readOnly={readOnly}
          onOpen={onOpen}
        />
      </div>
    </li>
  );
}
