import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { avatarTone } from '../profile/profileModel.js';
import { describe, initials, timeLabel, UNAVAILABLE } from './activityModel.js';

/** One entry: who, what, which record (or Record unavailable), section, time and Sample. */
export function ActivityRow({ item, userId, entries }) {
  const text = describe(item, { userId, entries });
  const unavailable = item.kind === 'record' && text.object === null;
  return (
    <li className="activity-row">
      <span className="activity-avatar" data-tone={avatarTone(item.actor.id)} aria-hidden="true">
        {initials(item.actor.name)}
        <span className={`activity-action-badge is-${text.tone}`}>
          <Icon name={text.icon} size={11} strokeWidth={2.4} />
        </span>
      </span>
      <div className="activity-body">
        <p className="activity-phrase">
          <strong>{text.actor}</strong> {text.verb}
          {text.noun && ` ${text.noun}`}
          {text.object && (
            <>
              {' '}
              <strong className="activity-object">{text.object}</strong>
            </>
          )}
          {unavailable && (
            <span className="activity-unavailable">
              <Icon name="lock" size={12} />
              {UNAVAILABLE}
            </span>
          )}
        </p>
        <p className="activity-meta">
          <span className="activity-section">
            <Icon name={text.sectionIcon || 'shield'} size={13} />
            {text.section}
          </span>
          {item.sample && <span className="activity-sample">Sample</span>}
          <time className="activity-time" dateTime={item.at}>
            {timeLabel(item.at)}
          </time>
        </p>
      </div>
    </li>
  );
}
