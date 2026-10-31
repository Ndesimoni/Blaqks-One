import React from 'react';
import { Button } from '../../../../components/ui/Button.jsx';
import {
  aboutLabel,
  assigneeLabel,
  contactParts,
  enquiryInstant,
  senderName,
  siteKind,
} from './enquiriesModel.js';

/** The display text for one enquiry, shared by the desktop table and the phone cards. */
export function enquiryView(enquiry, { k, titles, names, userId, siteId }) {
  const about = aboutLabel(enquiry, titles);
  const assignee = assigneeLabel(enquiry.assigneeId, names, userId);
  return {
    name: senderName(enquiry),
    contacts: contactParts(enquiry),
    instant: enquiryInstant(enquiry.createdAt),
    about: about.title || k(about.key),
    site: k(siteKind(enquiry, siteId)),
    assignee: assignee.name || k(assignee.key),
    message: String(enquiry.enquiry?.message || ''),
  };
}

/** Dubai wall-clock date and time, with the exact instant in `dateTime`. */
export function Received({ instant, format }) {
  return instant ? <time dateTime={instant}>{format.dateTime(instant)}</time> : <span>—</span>;
}

export function Sender({ view, k }) {
  return (
    <>
      <strong>{view.name}</strong>
      {view.contacts.length ? (
        view.contacts.map((contact) => (
          <span key={contact} className="website-list-sub">
            {contact}
          </span>
        ))
      ) : (
        <span className="website-list-sub">{k('noContact')}</span>
      )}
    </>
  );
}

/** Read the full message and Open lead; both name the visitor for screen readers. */
export function EnquiryActions({ enquiry, view, k, onRead, onOpenLead, leadReady }) {
  return (
    <div className="website-enquiry-actions">
      <Button
        variant="light"
        aria-label={k('readFor', { name: view.name })}
        onClick={() => onRead(enquiry.id)}
      >
        {k('read')}
      </Button>
      <Button
        variant="light"
        icon="external"
        disabled={!leadReady}
        aria-label={k('openLeadFor', { name: view.name })}
        onClick={() => onOpenLead(enquiry.leadId)}
      >
        {k('openLead')}
      </Button>
    </div>
  );
}
