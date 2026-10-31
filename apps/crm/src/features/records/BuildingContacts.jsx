import React from 'react';
import { get } from '../../lib/records.js';
import { selectBuildingContacts, telHref } from '../properties/buildingContacts.js';
import { RelatedRecords } from './RelatedRecords.jsx';
import { useRelatedRecords } from './useRelatedRecords.js';

const contactRow = (contact) => {
  const phone = String(get(contact, 'Phone') ?? '').trim();
  return {
    key: get(contact, 'Contact ID'),
    primary: String(get(contact, 'Full name') ?? '').trim() || get(contact, 'Contact ID'),
    secondary: get(contact, 'Contact type') || 'Contact',
    phone,
    tel: telHref(phone),
  };
};

/**
 * Loaded contacts saved for this property's building. The property's own linked contact is shown
 * in its Contact ID field, so it is left out here. Hidden without a building or Contacts access.
 */
export function BuildingContacts({ property, contacts }) {
  const { canSee, open } = useRelatedRecords();
  const building = String(get(property, 'Building / project') ?? '').trim();
  if (!building || !canSee('Contacts')) return null;
  return (
    <RelatedRecords
      icon="users"
      title="Building contacts"
      note={building}
      items={selectBuildingContacts(contacts, property)}
      row={contactRow}
      onOpen={(contact) => open('Contacts', contact)}
      empty="No contacts saved for this building yet."
    />
  );
}
