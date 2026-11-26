import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ClientLogForm } from './ClientLogForm.jsx';
import '../../records/panel/record-panel-timeline.css';

const ICONS = {
  created: 'plus',
  note: 'note',
  call: 'phone',
  whatsapp: 'chat',
  email: 'mail',
  sms: 'smartphone',
  stage: 'trend',
  linked: 'link',
  assigned: 'person',
};

/** One timeline entry: what happened and who, when, and what they wrote. */
function TimelineEntry({ entry }) {
  const { t, format } = useI18n();
  const what = t(`platformClients.kind.${entry.kind}`);
  return (
    <div className="record-event">
      <span className="record-event-dot" aria-hidden="true">
        <Icon name={ICONS[entry.kind]} size={16} />
      </span>
      <div className="record-event-body">
        <div className="record-event-head">
          <strong>{[what, entry.authorName].filter(Boolean).join(' · ')}</strong>
          {entry.at && <time dateTime={entry.at}>{format.dateTime(entry.at)}</time>}
        </div>
        {entry.body && <p className="record-event-detail">{entry.body}</p>}
      </div>
    </div>
  );
}

/**
 * The client's activity, newest first, in the CRM slider's timeline card: what the team
 * logged (calls, WhatsApp, emails, texts, notes) and what the server recorded (added, stage
 * changes, sign-up, assignment). Manage logs a new entry above the list.
 */
export function ClientTimeline({ client, timeline, manage, one }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const headingId = useId();
  return (
    <section className="record-timeline platform-client-timeline" aria-labelledby={headingId}>
      <div className="record-timeline-head">
        <h3 id={headingId}>{k('activity')}</h3>
        <span className="record-timeline-count">
          {k('activityCount', { count: timeline.length })}
        </span>
      </div>
      {manage && <ClientLogForm client={client} one={one} />}
      {timeline.length ? (
        <OverflowList
          items={timeline}
          getKey={(entry) => entry.id}
          label={k('activity')}
          listTag="ol"
          listClassName="record-timeline-list"
          renderItem={(entry) => <TimelineEntry entry={entry} />}
        />
      ) : (
        <p className="record-timeline-empty">{k('activityEmpty')}</p>
      )}
    </section>
  );
}
