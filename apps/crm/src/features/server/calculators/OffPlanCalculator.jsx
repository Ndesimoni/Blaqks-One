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
import { CalcPanel } from './CalcPanel.jsx';
import { CalculatorField } from './CalculatorField.jsx';
import { MilestoneRow } from './MilestoneRow.jsx';
import { offPlanRows } from './OffPlanRows.jsx';
import './off-plan.css';

const initialRows = (t) => [
  { id: 1, label: t('calculators.booking'), percent: '20', date: '' },
  { id: 2, label: t('calculators.construction'), percent: '40', date: '' },
  { id: 3, label: t('calculators.handover'), percent: '40', date: '' },
];

/**
 * Q6 off-plan schedule. Shares must total 100%; dates are optional but must be in order. The
 * schedule can be downloaded as CSV and is never written to a property or any other record.
 */
export function OffPlanCalculator() {
  const { t, format } = useI18n();
  const uid = useId();
  const nextId = useRef(4);
  const [price, setPrice] = useState('');
  const [rows, setRows] = useState(() => initialRows(t));
  const parsed = rows.map((row) => ({
    percent: parsePercent(row.percent),
    date: !row.date || isIsoDate(row.date),
  }));
  const percentInvalid = parsed.some(
    (entry) => entry.percent.error || entry.percent.value === null,
  );
  const totalBp = parsed.reduce((sum, entry) => sum + (entry.percent.value ?? 0), 0);
  const dated = rows.map((row) => row.date).filter(Boolean);
  const datesInvalid =
    parsed.some((entry) => !entry.date) || dated.some((day, index) => day < dated[index - 1]);
  const value = parseAed(price);
  const schedule = useMemo(() => {
    if (value.error || value.value === null || percentInvalid || datesInvalid) return null;
    if (totalBp !== 10_000) return null;
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
  }, [value.value, value.error, percentInvalid, totalBp, datesInvalid, rows, parsed]);
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
    const headers = ['milestone', 'date', 'percent', 'amount'].map((key) =>
      t(`calculators.${key}`),
    );
    const csv = scheduleCsv(schedule.milestones, headers, t('calculators.scheduleTotal'));
    downloadBlob(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
      'off-plan-schedule.csv',
    );
  };
  const sharesValid = !percentInvalid;
  return (
    <CalcPanel
      title={t('calculators.offPlanTitle')}
      note={<p className="calc-note">{t('calculators.offPlanNote')}</p>}
      result={{
        rows: offPlanRows({ t, format, rows, schedule, totalBp, sharesValid }),
        ready: Boolean(schedule),
        prompt: t('calculators.offPlanPrompt'),
        inputs: schedule ? [[t('calculators.price'), format.money(value.value)]] : [],
        actions: (
          <Button variant="light" icon="download" disabled={!schedule} onClick={exportSchedule}>
            {t('calculators.exportSchedule')}
          </Button>
        ),
      }}
    >
      <div className="calc-fields">
        <CalculatorField
          id={`${uid}-price`}
          label={t('calculators.price')}
          unit={t('calculators.aed')}
          value={price}
          placeholder={t('calculators.pricePlaceholder')}
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
      <Button variant="light" icon="plus" onClick={add} disabled={rows.length >= MAX_MILESTONES}>
        {t('calculators.addMilestone')}
      </Button>
      {percentInvalid && <p className="field-error">{t('calculators.offPlanPercent')}</p>}
      {datesInvalid && <p className="field-error">{t('calculators.offPlanOrder')}</p>}
    </CalcPanel>
  );
}
