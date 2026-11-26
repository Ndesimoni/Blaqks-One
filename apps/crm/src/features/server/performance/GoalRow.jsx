import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { formatFigure, progressOf } from './targetsModel.js';
import { goalStatus } from './chartModel.js';
import { TargetForm } from './TargetForm.jsx';

function noteText({ actual, target, pending, hidden }) {
  if (pending) return pending;
  if (hidden) return 'Target not shared with you';
  const percent = progressOf(actual, target?.value);
  if (percent !== null) return `${percent}% of target achieved`;
  if (target) return 'Target is 0';
  return 'No target set for this month';
}

function StatusChip({ status }) {
  if (!status) return null;
  return (
    <span className={`kpi-chip kpi-chip-${status.tone}`}>
      <Icon name={status.icon} size={13} />
      {status.label}
    </span>
  );
}

/**
 * One monthly goal card: the actual figure against its target, an accessible progress bar with
 * its percentage as text, and — for the workspace's Admin only — the target editor.
 * `pending` replaces the figure while finance loads or when it could not be loaded.
 */
export function GoalRow({ metric, actual, target, pending, hidden, editable, onSave }) {
  const id = useId();
  const percent = pending ? null : progressOf(actual, target?.value);
  const width = percent === null ? 0 : Math.min(100, percent);
  const note = noteText({ actual, target, pending, hidden });
  const status = goalStatus({ percent, target, hidden, pending });
  const met = percent !== null && percent >= 100;
  return (
    <article className={met ? 'goal kpi-card is-met' : 'goal kpi-card'} data-metric={metric.key}>
      <div className="kpi-head">
        <h3 id={`${id}-label`}>{metric.label}</h3>
        <StatusChip status={status} />
      </div>
      <p className={pending ? 'goal-figures is-pending' : 'goal-figures'}>
        <b>{pending ? '—' : formatFigure(metric.key, actual)}</b>
        {target && !pending && <span> / {formatFigure(metric.key, target.value)}</span>}
      </p>
      <div
        className={pending ? 'kpi-track is-loading' : 'kpi-track'}
        role="progressbar"
        aria-label={`${metric.label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-valuetext={note}
      >
        <div style={{ width: `${width}%` }} />
      </div>
      <p className="kpi-note">{note}</p>
      {editable && <TargetForm metric={metric} target={target} onSave={onSave} />}
    </article>
  );
}
