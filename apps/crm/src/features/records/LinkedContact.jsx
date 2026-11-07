import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { contactLabel, findContact } from '../properties/buildingContacts.js';
import { useRelatedRecords } from './useRelatedRecords.js';

/**
 * A property's Contact ID as "Full name · Contact type", opening that contact's details. A contact
 * that is missing, hidden by the server or outside the viewer's modules shows only the saved ID.
 */
export function LinkedContact({ id, contacts }) {
  const { canSee, open } = useRelatedRecords();
  const value = String(id ?? '').trim();
  if (!value) return '—';
  const contact = canSee('Contacts') ? findContact(contacts, value) : null;
  if (!contact) return `${value} · Linked record unavailable`;
  return (
    <button
      type="button"
      className="detail-link detail-record-link"
      onClick={() => open('Contacts', contact)}
    >
      <span>{contactLabel(contact)}</span>
      <Icon name="chevron" size={14} />
    </button>
  );
}
