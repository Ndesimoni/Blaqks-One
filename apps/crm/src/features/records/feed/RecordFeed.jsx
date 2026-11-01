import React from 'react';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { dateShift, today } from '../../../lib/dates.js';
import { get } from '../../../lib/records.js';
import { GridFoot } from '../grid/GridFoot.jsx';
import { usePagedRecords } from '../grid/usePagedRecords.js';
import { RecordTableEmpty } from '../RecordTableEmpty.jsx';
import { FeedEvent } from './FeedEvent.jsx';
import { dayCounts, dayLabelKey, feedFields, groupFeed, orderFeed } from './feedModel.js';
import '../grid/grid-card.css';
import './feed.css';

const PER_PAGE = 12;
const dayFormat = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };

/**
 * The Interaction log as an activity feed (Bitrix24 pattern, NAV): one event per
 * conversation, newest first and grouped by contact day, in the grid's card and footer. The
 * search, filters, pages and record actions are the directory's own.
 */
export function RecordFeed({ module, arr, emptyDetail }) {
  const { t, format } = useI18n();
  const { data } = useRecords();
  const { query } = useWorkspaceView();
  const { dispatchRow, readOnly = false } = useWorkspaceActions();
  const ordered = orderFeed(arr);
  const counts = dayCounts(ordered);
  const { current, currentPage, setPage } = usePagedRecords(ordered, PER_PAGE);
  const [now, yesterday] = [today(), dateShift(-1)];
  const heading = (day) => {
    const key = dayLabelKey(day, now, yesterday);
    return key ? t(`recordGrid.${key}`) : format.date(day, dayFormat);
  };
  return (
    <div className="grid-card record-feed">
      {current.length > 0 && (
        <section className="feed-days" aria-label={`${module} records`}>
          {groupFeed(current).map((group) => (
            <div key={group.day || 'undated'} className="feed-day">
              <h2 className="feed-day-title">
                {heading(group.day)}
                <span className="feed-day-count">
                  {t('recordGrid.dayCount', { count: counts.get(group.day) })}
                </span>
              </h2>
              <ol className="feed-events">
                {group.records.map((record, index) => (
                  <FeedEvent
                    key={get(record, feedFields.id) || index}
                    module={module}
                    data={data}
                    record={record}
                    readOnly={readOnly}
                    onOpen={() => dispatchRow(module, record)}
                  />
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}
      {!arr.length && (
        <RecordTableEmpty
          module={module}
          title="No matching records"
          detail={emptyDetail}
          query={query}
          readOnly={readOnly}
        />
      )}
      <GridFoot
        total={arr.length}
        page={currentPage}
        perPage={PER_PAGE}
        label={`${module} pages`}
        onPage={setPage}
      />
    </div>
  );
}
