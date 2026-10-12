import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { useRecords } from '../../../hooks/useWorkspace.js';
import { viewingTime } from './assignmentResponses.js';

/** Decision 6: other agents' viewings on a held listing, as date/time and agent only. */
export function ListingViewings({ record }) {
  const headingId = useId();
  const { listingViewings = [], scope } = useRecords();
  const items = listingViewings.filter((item) => item.property_id === record.property_id);
  if (scope !== 'assigned' && !items.length) return null;
  return (
    <section className="assignment-panel" aria-labelledby={headingId}>
      <div className="detail-section-heading">
        <Icon name="calendar" size={18} />
        <h3 id={headingId}>Other agents' viewings</h3>
      </div>
      {items.length ? (
        <OverflowList
          items={items}
          label="Booked viewings"
          listClassName="listing-viewings-list"
          renderItem={(item) => (
            <span>
              {viewingTime(item.appointment_date_time)} ·{' '}
              <strong>{item.agent ? item.agent.name : 'Unassigned'}</strong>
            </span>
          )}
        />
      ) : (
        <p className="assignment-hint">No other agents have viewings booked on this listing.</p>
      )}
      <small className="assignment-hint">Client details stay with the responsible agent.</small>
    </section>
  );
}
