import React from 'react';
import { RecordSchedule } from '../../calendar/RecordSchedule.jsx';
import { LinkedProperties } from '../LinkedProperties.jsx';
import { PropertyRecordDetails, PropertyRecordGallery } from '../PropertyRecordDetails.jsx';
import { RecordDetailFields } from '../RecordDetailFields.jsx';
import { RecordTimeline } from './RecordTimeline.jsx';
import './record-panel-body.css';

/**
 * What sits beside the facts: a client's activity timeline, a contact's properties, or a
 * listing's plans, amenities and building contacts. Other records have none, so their facts
 * use the full width (the empty column is hidden by CSS).
 */
function PanelSide({ module, record, data }) {
  if (module === 'Clients') return <RecordTimeline data={data} client={record} />;
  if (module === 'Contacts')
    return <LinkedProperties contact={record} properties={data?.Properties} />;
  if (module === 'Properties')
    return <PropertyRecordDetails record={record} contacts={data?.Contacts} />;
  return null;
}

/**
 * The scrolling body of the record panel: a listing's gallery across the top, then two
 * columns on wide screens (facts left, related content right) and one column on phones.
 * Connected-only sections (`extras`: assignment, sharing, website) open the facts column.
 */
export function RecordPanelBody({ module, record, data, edit, close, readOnly, extras }) {
  return (
    <div className="drawer-body record-panel-body">
      {module === 'Properties' && (
        <PropertyRecordGallery record={record} edit={edit} close={close} readOnly={readOnly} />
      )}
      <div className="record-panel-columns">
        <div className="record-panel-main">
          {extras}
          {['Follow-ups', 'Viewings'].includes(module) && (
            <RecordSchedule module={module} record={record} data={data} />
          )}
          <RecordDetailFields module={module} record={record} data={data} />
        </div>
        <div className="record-panel-side">
          <PanelSide module={module} record={record} data={data} />
        </div>
      </div>
    </div>
  );
}
