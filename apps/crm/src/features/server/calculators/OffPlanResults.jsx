import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/** Readable milestone table plus the CSV export control. */
export function OffPlanResults({ schedule, totalShareBp, onExport }) {
  const { t, format } = useI18n();
  if (!schedule) return <p className="calc-note">{t('calculators.offPlanPrompt')}</p>;
  return (
    <>
      <table className="calc-schedule">
        <caption className="sr-only">{t('calculators.schedule')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('calculators.milestone')}</th>
            <th scope="col">{t('calculators.date')}</th>
            <th scope="col">{t('calculators.percent')}</th>
            <th scope="col">{t('calculators.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {schedule.milestones.map((row) => (
            <tr key={`${row.label}-${row.date}`}>
              <td>{row.label}</td>
              <td>{format.date(row.date)}</td>
              <td>{format.percent(row.percentBp)}</td>
              <td>{format.money(row.amountFils)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t('calculators.total')}</th>
            <td />
            <td>{format.percent(totalShareBp)}</td>
            <td>{format.money(schedule.totalFils)}</td>
          </tr>
        </tfoot>
      </table>
      <Button variant="light" icon="download" onClick={onExport}>
        {t('calculators.exportSchedule')}
      </Button>
    </>
  );
}
