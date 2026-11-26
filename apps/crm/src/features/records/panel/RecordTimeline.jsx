import React, { useId } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useWorkspaceActions } from '../../../hooks/useWorkspace.js';
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
  shortlist: 'recordPanel.eventShortlist',
};

/**
 * The mockup's add-activity buttons: a follow-up, viewing or conversation (the mockup's Note)
 * already linked to this client or listing, for people who may create them. Each opens the
 * usual editor; `link(module)` gives the linking field.
 */
function TimelineAdd({ link }) {
  const { t } = useI18n();
  const { add, can, readOnly = false } = useWorkspaceActions();
  if (readOnly || !add) return null;
  const choices = [
    ['Follow-ups', 'recordPanel.addFollowUp'],
    ['Viewings', 'recordPanel.addViewing'],
    ['Interaction log', 'recordPanel.addConversation'],
  ].filter(([module]) => (can ? can(module, 'create') : true));
  if (!choices.length) return null;
  return (
    <div className="record-timeline-add">
      {choices.map(([module, label]) => (
        <button
          key={module}
          type="button"
          className="btn btn-light"
          onClick={() => add(module, link(module))}
        >
          <Icon name="plus" size={15} />
          <span>{t(label)}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * A client's or (`property`) a listing's activity, newest first: the follow-ups, viewings,
 * shortlists, conversations and client care already loaded for this workspace, limited to the
 * collections the viewer may open, with the mockup's buttons to add linked activity.
 * Hidden without any of that access.
 */
export function RecordTimeline({ data, client, property }) {
  const { t } = useI18n();
  const { canSee } = useRelatedRecords();
  const headingId = useId();
  if (!activityModules.some(canSee)) return null;
  const record = property || client;
  const kind = property ? 'property' : 'client';
  const entries = selectRecordTimeline(data, record, canSee, kind);
  // A conversation names its listing in the optional property field.
  const link = (module) =>
    property
      ? {
          [module === 'Interaction log' ? 'property_id_optional' : 'property_id']:
            property.property_id,
        }
      : { client_id: client.client_id };
  const label = t('recordPanel.activity');
  return (
    <section className="record-timeline" aria-labelledby={headingId}>
      <div className="record-timeline-head">
        <h3 id={headingId}>{label}</h3>
        <span className="record-timeline-count">
          {t('recordPanel.activityCount', { count: entries.length })}
        </span>
      </div>
      <p className="record-timeline-hint">
        {t(property ? 'recordPanel.listingActivityHint' : 'recordPanel.activityHint')}
      </p>
      <TimelineAdd link={link} />
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
