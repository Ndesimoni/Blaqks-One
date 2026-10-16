import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useRecordAccess } from '../../records/useRecordAccess.js';
import { DashSection, SectionEmpty, SectionLink } from './DashSection.jsx';
import { agendaFollowUps } from './agendaModel.js';
import { FollowUpRow, HeldViewingRow, ViewingRow } from './AgendaRows.jsx';
import { TodayTimeline } from './TodayTimeline.jsx';
import './dashboard-timeline.css';

const dayFormat = new Intl.DateTimeFormat('en-AE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Dubai',
});

function GroupHead({ title, caption, link }) {
  return (
    <div className="agenda-group-head">
      <h3 className="v2-label">{title}</h3>
      {link}
      {caption && <p className="v2-caption">{caption}</p>}
    </div>
  );
}

/**
 * Today: a 09:00–19:00 timeline of today's viewings and follow-ups, then the agenda lists:
 * follow-ups due today or overdue first, then the next open ones, and the next viewings.
 * Other agents' viewings on the caller's listings show time, property and agent only, cannot
 * be opened, and keep client details with the responsible agent.
 */
export function Agenda({
  summary,
  viewings,
  allViewings,
  today,
  clientName,
  propertyName,
  className,
  style,
}) {
  const { navigate } = useNavigation();
  const { add, dispatchRow } = useWorkspaceActions();
  const canAdd = useRecordAccess()('Follow-ups', 'create');
  const tasks = agendaFollowUps(summary);
  const held = viewings.some((entry) => entry.kind === 'held');
  return (
    <DashSection
      className={className}
      style={style}
      label={`Today · ${dayFormat.format(new Date())}`}
      caption="Today’s viewings and follow-ups, Dubai time"
    >
      <TodayTimeline
        viewings={allViewings}
        dueTasks={summary.dueTasks}
        today={today}
        clientName={clientName}
        propertyName={propertyName}
        onOpen={dispatchRow}
      />
      <div className="agenda-groups">
        <div className="agenda-group" data-agenda="follow-ups">
          <GroupHead
            title="Follow-ups"
            link={<SectionLink onClick={() => navigate('Follow-ups')}>All tasks</SectionLink>}
          />
          {tasks.length > 0 && (
            <ul className="agenda-list">
              {tasks.map((task, index) => (
                <FollowUpRow
                  key={index}
                  task={task}
                  today={today}
                  clientName={clientName}
                  onOpen={() => dispatchRow('Follow-ups', task)}
                />
              ))}
            </ul>
          )}
          {!summary.tasks.length && (
            <SectionEmpty>
              You’re all caught up.{' '}
              {canAdd ? 'Add a follow-up to keep momentum going.' : 'No pending follow-ups.'}
            </SectionEmpty>
          )}
          {canAdd && (
            <button type="button" className="v2-link agenda-add" onClick={() => add('Follow-ups')}>
              <Icon name="plus" size={14} /> Create follow-up
            </button>
          )}
        </div>
        <div className="agenda-group" data-agenda="viewings">
          <GroupHead
            title="Upcoming viewings"
            caption={
              held
                ? 'Your next appointments and others booked on your listings'
                : 'Your next scheduled appointments'
            }
            link={<SectionLink onClick={() => navigate('Viewings')}>Manage viewings</SectionLink>}
          />
          {viewings.length > 0 && (
            <ul className="agenda-list">
              {viewings.map((entry, index) =>
                entry.kind === 'held' ? (
                  <HeldViewingRow
                    key={index}
                    entry={entry}
                    today={today}
                    propertyName={propertyName}
                  />
                ) : (
                  <ViewingRow
                    key={index}
                    entry={entry}
                    today={today}
                    clientName={clientName}
                    propertyName={propertyName}
                    onOpen={() => dispatchRow('Viewings', entry.record)}
                  />
                ),
              )}
            </ul>
          )}
          {!viewings.length && <SectionEmpty>No upcoming viewings yet.</SectionEmpty>}
          {held && (
            <p className="agenda-note">
              <Icon name="lock" size={13} />
              Client details stay with the responsible agent.
            </p>
          )}
        </div>
      </div>
    </DashSection>
  );
}
