import React, { useMemo } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { ActivityRow } from './ActivityRow.jsx';
import { ActivityMessage, ActivitySkeleton } from './ActivityStates.jsx';
import { groupByDay } from './activityModel.js';
import { groupRepeats } from './activityGrouping.js';

/**
 * The feed grouped by Dubai day, newest first, with repeats of one action collapsed into a row
 * and Load more driven by the server cursor.
 * There is deliberately no total count: the server never reports one.
 */
export function ActivityResults({ feed, entries, userId, today, manager, filtered, onClear }) {
  const groups = useMemo(
    () => groupByDay(feed.items, today).map((day) => ({ ...day, rows: groupRepeats(day.items) })),
    [feed.items, today],
  );
  const clear = filtered && (
    <Button variant="light" icon="close" onClick={onClear}>
      Clear filters
    </Button>
  );
  if (feed.status === 'invalid')
    return (
      <ActivityMessage icon="calendar" title="Check the dates">
        Choose a start date on or before the end date, within 366 days.
      </ActivityMessage>
    );
  if (feed.status === 'loading') return <ActivitySkeleton />;
  if (feed.status === 'forbidden')
    return (
      <ActivityMessage icon="lock" title="This activity isn't available to you" tone="danger" alert>
        Your access doesn't include this view of the workspace. Ask your Admin if you need it.
        {clear && ' You can also clear the filters to see the activity you can open.'}
      </ActivityMessage>
    );
  if (feed.status === 'error')
    return (
      <ActivityMessage
        icon="info"
        title="Activity couldn't be loaded"
        tone="danger"
        alert
        action={
          <Button variant="light" icon="arrow" onClick={feed.retry}>
            Try again
          </Button>
        }
      >
        {feed.error}
      </ActivityMessage>
    );
  if (!feed.items.length)
    return (
      <ActivityMessage icon="clock" title="No matching activity" action={clear}>
        {filtered
          ? 'Nothing was recorded for these filters. Try a wider date range or fewer filters.'
          : manager
            ? 'Changes your team makes in this workspace will appear here.'
            : 'Changes you make in this workspace will appear here.'}
      </ActivityMessage>
    );
  return (
    <section className="panel activity-feed" aria-label="Activity">
      {groups.map((group) => (
        <section key={group.day} className="activity-day" aria-labelledby={`day-${group.day}`}>
          <h3 className="activity-day-head" id={`day-${group.day}`}>
            {group.label}
            {group.date && <span className="activity-day-date">{group.date}</span>}
          </h3>
          <ul className="activity-feed-list">
            {group.rows.map((row) => (
              <ActivityRow key={row.id} row={row} userId={userId} entries={entries} />
            ))}
          </ul>
        </section>
      ))}
      <div className="activity-feed-foot">
        {feed.next ? (
          <Button
            variant="light"
            onClick={feed.loadMore}
            disabled={feed.more}
            aria-busy={feed.more}
          >
            {feed.more ? 'Loading…' : 'Load more activity'}
          </Button>
        ) : (
          <p>You've reached the start of this date range.</p>
        )}
        {feed.moreError && (
          <p className="field-error" role="alert">
            {feed.moreError} Select Load more activity to try again.
          </p>
        )}
      </div>
    </section>
  );
}
