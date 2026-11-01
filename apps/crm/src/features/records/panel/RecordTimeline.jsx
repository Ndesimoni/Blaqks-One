import React, { useId } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { dateNum, readableDate } from '../../../lib/dates.js';
import { useRelatedRecords } from '../useRelatedRecords.js';
import { activityModules, selectRecordTimeline, timeOfDay } from './timelineModel.js';
import './record-panel-timeline.css';

const eventKeys = {
  followUp: 'recordPanel.eventFollowUp',
  viewing: 'recordPanel.eventViewing',
  interaction: 'recordPanel.eventInteraction',
  care: 'recordPanel.eventCare',
};

/**
 * A client's activity, newest first: the follow-ups, viewings, conversations and client care
 * already loaded for this workspace, limited to the collections the viewer may open. It only
 * reads; new activity is still added from those pages. Hidden without any of that access.
 */
export function RecordTimeline({ data, client }) {
  const { t } = useI18n();
  const { canSee } = useRelatedRecords();
  const headingId = useId();
  if (!activityModules.some(canSee)) return null;
  const entries = selectRecordTimeline(data, client, canSee);
  const label = t('recordPanel.activity');
  return (
    <section className="record-timeline" aria-labelledby={headingId}>
      <div className="record-timeline-head">
        <h3 id={headingId}>{label}</h3>
        <span className="record-timeline-count">
          {t('recordPanel.activityCount', { count: entries.length })}
        </span>
      </div>
      <p className="record-timeline-hint">{t('recordPanel.activityHint')}</p>
      {entries.length ? (
        <OverflowList
          items={entries}
          getKey={(entry) => entry.key}
          label={label}
          listTag="ol"
          listClassName="record-timeline-list"
          renderItem={(entry) => <TimelineEvent entry={entry} />}
        />
      ) : (
        <p className="record-timeline-empty">{t('recordPanel.activityEmpty')}</p>
      )}
    </section>
  );
}

function TimelineEvent({ entry }) {
  const { t } = useI18n();
  const dated = dateNum(entry.date) > 0;
  const when = dated
    ? [readableDate(entry.date), timeOfDay(entry.date)].filter(Boolean).join(' · ')
    : entry.date || t('recordPanel.undated');
  return (
    <div className="record-event">
      <span className="record-event-dot" aria-hidden="true">
        <Icon name={entry.icon} size={16} />
      </span>
      <div className="record-event-body">
        <div className="record-event-head">
          <strong>{[t(eventKeys[entry.kind]), entry.label].filter(Boolean).join(' · ')}</strong>
          <time dateTime={/^\d{4}-\d{2}-\d{2}/.test(entry.date) ? entry.date : undefined}>
            {when}
          </time>
        </div>
        {entry.title && <p className="record-event-title">{entry.title}</p>}
        {entry.detail && <p className="record-event-detail">{entry.detail}</p>}
      </div>
      {entry.status ? <Badge>{entry.status}</Badge> : null}
    </div>
  );
}
