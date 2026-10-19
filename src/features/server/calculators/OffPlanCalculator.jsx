import React, { useId, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { parseAed, parsePercent } from '../../../lib/finance/money.js';
import {
  MAX_MILESTONES,
  isIsoDate,
  offPlanSchedule,
  scheduleCsv,
} from '../../../lib/finance/offPlan.js';
import { downloadBlob } from '../../../services/files/download.js';
import { CalculatorField } from './CalculatorField.jsx';
import { MilestoneRow } from './MilestoneRow.jsx';
import { OffPlanResults } from './OffPlanResults.jsx';
import './off-plan.css';

const initialRows = (t) => [
  { id: 1, label: t('calculators.booking'), percent: '20', date: '' },
  { id: 2, label: t('calculators.construction'), percent: '40', date: '' },
  { id: 3, label: t('calculators.handover'), percent: '40', date: '' },
];

/**
 * Q6 off-plan schedule. Shares must total 100% and dates must be ordered; the schedule is
 * exported as CSV and never written to a property or any other record.
 */
export function OffPlanCalculator() {
  const { t, format } = useI18n();
  const uid = useId();
  const nextId = useRef(4);
  const [price, setPrice] = useState('');
  const [rows, setRows] = useState(() => initialRows(t));
  const parsed = rows.map((row) => ({
    percent: parsePercent(row.percent),
    date: isIsoDate(row.date),
  }));
  const percentInvalid = parsed.some(
    (entry) => entry.percent.error || entry.percent.value === null,
  );
  const totalBp = parsed.reduce((sum, entry) => sum + (entry.percent.value ?? 0), 0);
  const totalInvalid = !percentInvalid && totalBp !== 10_000;
  const datesInvalid =
    parsed.some((entry) => !entry.date) ||
    rows.some((row, index) => index > 0 && row.date < rows[index - 1].date);
  const value = parseAed(price);
  const schedule = useMemo(() => {
    if (value.error || value.value === null || percentInvalid || totalInvalid || datesInvalid)
      return null;
    try {
      return offPlanSchedule({
        priceFils: value.value,
        milestones: rows.map((row, index) => ({
          label: row.label,
          percentBp: parsed[index].percent.value,
          date: row.date,
        })),
      });
    } catch {
      return null;
    }
  }, [value.value, value.error, percentInvalid, totalInvalid, datesInvalid, rows, parsed]);
  const change = (id, key, next) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: next } : row)));
  const add = () => {
    if (rows.length >= MAX_MILESTONES) return;
    setRows((current) => [...current, { id: nextId.current++, label: '', percent: '', date: '' }]);
  };
  const remove = (id) => {
    if (rows.length > 1) setRows((current) => current.filter((row) => row.id !== id));
  };
  const exportSchedule = () => {
    if (!schedule) return;
    const headers = ['milestone', 'date', 'percent', 'amount'].map((key) =>
      t(`calculators.${key}`),
    );
    const csv = scheduleCsv(schedule.milestones, headers);
    downloadBlob(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
      'off-plan-schedule.csv',
    );
  };
  return (
    <section className="panel calc-card" aria-labelledby={`${uid}-title`}>
      <h3 id={`${uid}-title`}>{t('calculators.offPlanTitle')}</h3>
      <p className="calc-body">{t('calculators.offPlanBody')}</p>
      <div className="calc-grid">
        <CalculatorField
          id={`${uid}-price`}
          label={t('calculators.price')}
          prefix="AED"
          value={price}
          onChange={setPrice}
          error={value.error ? 'calculators.invalidPrice' : ''}
        />
      </div>
      <div className="milestone-list">
        {rows.map((row, index) => (
          <MilestoneRow
            key={row.id}
            row={row}
            canRemove={rows.length > 1}
            percentError={
              Boolean(parsed[index].percent.error) || parsed[index].percent.value === null
            }
            dateError={!parsed[index].date}
            onChange={change}
            onRemove={remove}
          />
        ))}
      </div>
      <div className="milestone-actions">
        <Button variant="light" onClick={add} disabled={rows.length >= MAX_MILESTONES}>
          {t('calculators.addMilestone')}
        </Button>
        <span className="calc-note">
          {t('calculators.totalShare')}: {format.percent(totalBp)}
        </span>
      </div>
      {percentInvalid && <p className="field-error">{t('calculators.offPlanPercent')}</p>}
      {totalInvalid && <p className="field-error">{t('calculators.offPlanTotal')}</p>}
      {datesInvalid && <p className="field-error">{t('calculators.offPlanOrder')}</p>}
      <section className="calc-results" aria-live="polite" aria-label={t('calculators.schedule')}>
        <h4>{t('calculators.schedule')}</h4>
        <OffPlanResults schedule={schedule} totalShareBp={totalBp} onExport={exportSchedule} />
      </section>
    </section>
  );
}
