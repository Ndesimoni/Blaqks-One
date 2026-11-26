import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { stageTrack } from './stageModel.js';
import './record-panel-stage.css';

/**
 * A client's Lead stage, or (`stages`, `labelKey`) a deal's, as a read-only pipeline track
 * (Bitrix24's stage bar): finished stages tinted, the current one filled. Narrow panels
 * shorten it to bars with a caption. Nothing here is a control.
 */
export function StageTrack({ value, stages, labelKey = 'recordPanel.stageTrack' }) {
  const { t } = useI18n();
  const track = stageTrack(value, stages);
  const { position, total } = track;
  const label = track.stage ? t(labelKey, { stage: track.stage }) : t('recordPanel.stageNone');
  const caption = track.offPath
    ? t('recordPanel.stageOffPath', { stage: track.offPath })
    : position
      ? `${track.stage} · ${t('recordPanel.stagePosition', { position, total })}`
      : t('recordPanel.stageNone');
  return (
    <div className="record-stage">
      <ol className={'record-stage-track' + (position ? '' : ' is-outside')} aria-label={label}>
        {track.steps.map((step) => (
          <li
            key={step.label}
            className={`record-stage-step is-${step.state}`}
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            <span className="record-stage-name">{step.label}</span>
          </li>
        ))}
      </ol>
      {/* The list's name already carries the stage, so the caption is for sighted users. */}
      <p className={'record-stage-caption' + (position ? '' : ' is-needed')} aria-hidden="true">
        {caption}
      </p>
    </div>
  );
}
