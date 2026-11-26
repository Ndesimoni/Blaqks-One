import React, { useContext } from 'react';
import { RecordsContext } from '../../app/WorkspaceContext.js';
import { useI18n } from '../../i18n/useI18n.js';
import './kept-chip.css';

/**
 * "View only" on a handed-over client or listing the caller still reads (agreements design
 * §18), or a colleague's shared copy (record sharing R1). Only connected records carry
 * keeps, so the demo never shows it.
 */
export function KeptChip({ module, record }) {
  const records = useContext(RecordsContext);
  const { t } = useI18n();
  const badge = records?.keptFor?.(module === 'Leads' ? 'Clients' : module, record);
  if (!badge) return null;
  const hint = { shared: 'chipShared', colleague: 'chipColleague' }[badge.reason] || 'chipHanded';
  return (
    <span className="record-kept-chip" title={t(`recordKeeps.${hint}`, { name: badge.other.name })}>
      {t('recordKeeps.chip')}
    </span>
  );
}
