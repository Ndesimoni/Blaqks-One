import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { readableDate } from '../../../lib/dates.js';
import { clName, get, prName } from '../../../lib/records.js';
import { RecordRowActions } from '../RecordRowActions.jsx';
import { ChannelIcon } from './ChannelIcon.jsx';
import { channelKind, feedFields as F, feedMoment, feedWay } from './feedModel.js';

const text = (record, field) => String(get(record, field) ?? '').trim();
const title = (word) => word[0].toUpperCase() + word.slice(1);

/**
 * One conversation, as the approved mockup's feed: channel icon, then who and how ("Email to
 * Omar Farouk") and the time; the topic and listing; the summary; then the follow-up action,
 * its due date and status. Without a linked client the topic leads, with channel and
 * direction beside the time. A click anywhere opens the record, as a table row does; the
 * Open record button serves the keyboard.
 */
export function FeedEvent({ module, data, record, readOnly, onOpen }) {
  const { t } = useI18n();
  const { day, time } = feedMoment(get(record, F.when));
  const channel = text(record, F.channel);
  const kind = channelKind(channel);
  const direction = text(record, F.direction);
  const way = feedWay(kind, direction);
  const client = text(record, F.client) && clName(data, text(record, F.client));
  const topic = text(record, F.topic);
  // A custom channel keeps its own name; "Other" or none reads as a conversation.
  const custom = kind === 'note' && channel && !/^other$/i.test(channel);
  const what = custom ? channel : t(`recordGrid.feed${title(kind)}`);
  const headline = client
    ? t('recordGrid.feedTitle', { what, way: t(`recordGrid.feed${title(way)}`), name: client })
    : topic || t('recordGrid.untitled');
  // A call's or meeting's title has no direction, and a title without a client no channel.
  const meta = client ? [way === 'with' ? direction : ''] : [channel, direction];
  const links = [
    client && topic,
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
          <strong className="feed-title">{headline}</strong>
          {(time || meta.some(Boolean)) && (
            <span className="feed-when">
              {time && <time dateTime={`${day}T${time}`}>{time}</time>}
              {meta.filter(Boolean).map((item, index) => (
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
