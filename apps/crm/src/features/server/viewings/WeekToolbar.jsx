import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { shiftDay } from '../../../lib/dubaiDate.js';

/**
 * The mockup's calendar toolbar: Today, the week range ("2 – 8 November 2026"), and our
 * previous and next week arrows beside it; the Dubai time zone and the week's count follow.
 */
export function WeekToolbar({ start, today, count, onChange }) {
  const { t, format } = useI18n();
  const end = shiftDay(start, 6);
  const full = { day: 'numeric', month: 'long', year: 'numeric' };
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = format.date(start, sameMonth ? { day: 'numeric' } : full);
  return (
    <div className="viewing-week-toolbar">
      <button type="button" className="btn btn-light" onClick={() => onChange(today)}>
        <span>{t('viewings.today')}</span>
      </button>
      <div className="viewing-week-arrows">
        <button
          type="button"
          className="grid-tool viewing-week-previous"
          aria-label={t('viewings.previous')}
          title={t('viewings.previous')}
          onClick={() => onChange(shiftDay(start, -7))}
        >
          <Icon name="chevron" size={18} />
        </button>
        <button
          type="button"
          className="grid-tool"
          aria-label={t('viewings.next')}
          title={t('viewings.next')}
          onClick={() => onChange(shiftDay(start, 7))}
        >
          <Icon name="chevron" size={18} />
        </button>
      </div>
      <div className="viewing-week-range" aria-live="polite" aria-atomic="true">
        <h2>{t('viewings.range', { from, to: format.date(end, full) })}</h2>
        <p>
          {t('viewings.timezone')} · {t('viewings.weekCount', { count })}
        </p>
      </div>
    </div>
  );
}
