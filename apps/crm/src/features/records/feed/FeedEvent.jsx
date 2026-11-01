import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { readableDate } from '../../../lib/dates.js';
import { clName, get, prName } from '../../../lib/records.js';
import { RecordRowActions } from '../RecordRowActions.jsx';
import { ChannelIcon } from './ChannelIcon.jsx';
import { channelKind, feedFields as F, feedMoment } from './feedModel.js';

const text = (record, field) => String(get(record, field) ?? '').trim();

/**
 * One conversation: channel icon, topic, time, channel and direction; the linked client and
 * listing; the summary; then the follow-up action, its due date and status. A click anywhere
 * opens the record, as a table row does; the Open record button serves the keyboard.
 */
export function FeedEvent({ module, data, record, readOnly, onOpen }) {
  const { t } = useI18n();
  const { day, time } = feedMoment(get(record, F.when));
  const channel = text(record, F.channel);
  const kind = channelKind(channel);
  const meta = [channel, text(record, F.direction)].filter(Boolean);
  const links = [
    text(record, F.client) && clName(data, text(record, F.client)),
    text(record, F.property) && prName(data, text(record, F.property)),
  ].filter(Boolean);
  const summary = text(record, F.summary);
  const [next, due, status] = [F.next, F.due, F.status].map((field) => text(record, field));
  return (
    <li className="feed-event" onClick={onOpen}>
      <span className={`feed-dot is-${kind}`}>
        <ChannelIcon kind={kind} />
      </span>
      <div className="feed-body">
        <p className="feed-line">
          <strong className="feed-title">
            {text(record, F.topic) || t('recordGrid.untitled')}
          </strong>
          {(time || meta.length > 0) && (
            <span className="feed-when">
              {time && <time dateTime={`${day}T${time}`}>{time}</time>}
              {meta.map((item, index) => (
                <span key={index}>{item}</span>
              ))}
            </span>
          )}
        </p>
        {links.length > 0 && (
          <p className="feed-links">
            {links.map((name, index) => (
              <span key={index}>{name}</span>
            ))}
          </p>
        )}
        {summary && <p className="feed-text">{summary}</p>}
        {(next || due || status) && (
          <p className="feed-next">
            {next && <span>{t('recordGrid.next', { action: next })}</span>}
            {due && <span>{t('recordGrid.due', { date: readableDate(due) })}</span>}
            {status && <Badge>{status}</Badge>}
          </p>
        )}
      </div>
      <div className="feed-actions">
        <RecordRowActions
          module={module}
          record={record}
          id={text(record, F.id)}
          readOnly={readOnly}
          onOpen={onOpen}
        />
      </div>
    </li>
  );
}
