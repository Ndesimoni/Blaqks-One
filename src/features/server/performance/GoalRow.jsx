import React from 'react';
import { formatFigure, progressOf } from './targetsModel.js';
import { TargetForm } from './TargetForm.jsx';

function Note({ actual, target, pending, hidden }) {
  if (pending) return <small>{pending}</small>;
  if (hidden) return <small>Target not shared with you</small>;
  const percent = progressOf(actual, target?.value);
  if (percent !== null) return <small>{percent}% of target achieved</small>;
  if (target) return <small>Target is 0</small>;
  return <small>No target set for this month</small>;
}

/**
 * One monthly goal: the actual figure, the target (read-only for members) and progress.
 * `pending` replaces the figure while finance loads or when it could not be loaded.
 */
export function GoalRow({ metric, actual, target, pending, hidden, editable, onSave }) {
  const percent = pending ? null : progressOf(actual, target?.value);
  const width = percent === null ? 0 : Math.min(100, percent);
  return (
    <div className="goal" data-metric={metric.key}>
      <div className="goal-top">
        <strong>{metric.label}</strong>
        <span className="goal-figures">
          <b>{pending ? '—' : formatFigure(metric.key, actual)}</b>
          {target && !editable && <> / {formatFigure(metric.key, target.value)}</>}
        </span>
      </div>
      <div
        className="goal-track"
        role="progressbar"
        aria-label={`${metric.label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
      >
        <div style={{ width: `${width}%` }} />
      </div>
      <Note actual={actual} target={target} pending={pending} hidden={hidden} />
      {editable && <TargetForm metric={metric} target={target} onSave={onSave} />}
    </div>
  );
}
