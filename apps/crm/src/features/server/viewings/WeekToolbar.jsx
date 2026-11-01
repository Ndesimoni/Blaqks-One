import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { shiftDay } from '../../../lib/dubaiDate.js';

export function WeekToolbar({ start, today, count, onChange }) {
  const { t, format } = useI18n();
  const date = (day) => format.date(day, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="viewing-week-toolbar">
      <div className="viewing-week-range" aria-live="polite" aria-atomic="true">
        <h2>{t('viewings.range', { from: date(start), to: date(shiftDay(start, 6)) })}</h2>
        <p>
          {t('viewings.timezone')} · {t('viewings.weekCount', { count })}
        </p>
      </div>
      <div className="viewing-week-navigation">
        <Button onClick={() => onChange(shiftDay(start, -7))}>{t('viewings.previous')}</Button>
        <Button onClick={() => onChange(today)}>{t('viewings.today')}</Button>
        <Button onClick={() => onChange(shiftDay(start, 7))}>{t('viewings.next')}</Button>
      </div>
    </div>
  );
}
