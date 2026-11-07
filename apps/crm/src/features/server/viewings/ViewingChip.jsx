import React from 'react';
import { statusClass } from '../../../components/ui/Badge.jsx';
import { useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { clName, get, prName } from '../../../lib/records.js';
import { viewingMoment } from './weekModel.js';

/**
 * One viewing as the mockup's event chip in a time slot: "10:30 Marina Gate" over the client
 * and status, coloured by status with the badge tones. It opens the record slider, which owns
 * editing, versions and authorization.
 */
export function ViewingChip({ record }) {
  const { t } = useI18n();
  const { data } = useRecords();
  const { dispatchRow } = useWorkspaceActions();
  const { time } = viewingMoment(get(record, 'Appointment date & time'));
  const id = String(get(record, 'Viewing ID') ?? '');
  const property = get(record, 'Property ID');
  const client = get(record, 'Client ID');
  const status = get(record, 'Viewing status') || t('viewings.noStatus');
  const place = property ? prName(data, property) : t('viewings.untitled');
  const title = time ? `${time} ${place}` : place;
  const detail = [client && clName(data, client), status].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      className={`event-chip badge badge-${statusClass(status)}`}
      aria-label={t('recordGrid.openNamed', { name: `${title}, ${detail}`, id })}
      onClick={() => dispatchRow('Viewings', record)}
    >
      <strong>{title}</strong>
      <span>{detail}</span>
    </button>
  );
}
