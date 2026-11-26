import React from 'react';
import { RecordSchedule } from '../../calendar/RecordSchedule.jsx';
import { LinkedProperties } from '../LinkedProperties.jsx';
import { PropertyRecordDetails, PropertyRecordGallery } from '../PropertyRecordDetails.jsx';
import { PropertySummary } from '../PropertySummary.jsx';
import { RecordDetailFields } from '../RecordDetailFields.jsx';
import { RecordTimeline } from './RecordTimeline.jsx';
import './record-panel-body.css';
import './record-panel-gallery.css';

/**
 * What sits beside the facts: a client's or a listing's activity timeline, or a contact's
 * properties. Other records have none, so their facts use the full width (the empty column
 * is hidden by CSS).
 */
function PanelSide({ module, record, data }) {
  if (module === 'Clients') return <RecordTimeline data={data} client={record} />;
  if (module === 'Properties') return <RecordTimeline data={data} property={record} />;
  if (module === 'Contacts')
    return <LinkedProperties contact={record} properties={data?.Properties} />;
  return null;
}

/**
 * The scrolling body of the record slider, as the approved mockup lays it out: a listing's
 * gallery across the top, then two columns on wide screens (facts left, activity or related
 * records right) and one on phones. Connected sections (`extras`: assignment, sharing,
 * website) follow in a card grid, then a listing's plans, amenities, building contacts and
 * every remaining field.
 */
export function RecordPanelBody({ module, record, data, edit, close, readOnly, extras }) {
  const listing = module === 'Properties';
  return (
    <div className="drawer-body record-panel-body">
      {listing && (
        <PropertyRecordGallery record={record} edit={edit} close={close} readOnly={readOnly} />
      )}
      <div className="record-panel-columns">
        <div className="record-panel-main">
          {['Follow-ups', 'Viewings'].includes(module) && (
            <RecordSchedule module={module} record={record} data={data} />
          )}
          {listing ? (
            <PropertySummary record={record} data={data} />
          ) : (
            <RecordDetailFields module={module} record={record} data={data} />
          )}
        </div>
        <div className="record-panel-side">
          <PanelSide module={module} record={record} data={data} />
        </div>
      </div>
      {extras && <div className="record-panel-sections">{extras}</div>}
      {listing && (
        <>
          <PropertyRecordDetails record={record} contacts={data?.Contacts} />
          <RecordDetailFields module={module} record={record} data={data} />
        </>
      )}
    </div>
  );
}
