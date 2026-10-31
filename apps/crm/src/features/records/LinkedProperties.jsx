import React from 'react';
import { get } from '../../lib/records.js';
import {
  propertySummary,
  selectBuildingProperties,
  selectLinkedProperties,
} from '../contacts/linkedProperties.js';
import { RelatedRecords } from './RelatedRecords.jsx';
import { useRelatedRecords } from './useRelatedRecords.js';

const propertyRow = (property) => ({
  key: get(property, 'Property ID'),
  primary: String(get(property, 'Listing title') ?? '').trim() || get(property, 'Property ID'),
  secondary: propertySummary(property),
});

/**
 * A contact's linked properties and other properties in its building, from loaded Properties only.
 * Each section is hidden when it is empty or the viewer has no Properties access.
 */
export function LinkedProperties({ contact, properties = [] }) {
  const { canSee, open } = useRelatedRecords();
  if (!canSee('Properties')) return null;
  const linked = selectLinkedProperties(properties, contact);
  const nearby = selectBuildingProperties(properties, contact);
  const section = (title, icon, items, note) =>
    items.length > 0 && (
      <RelatedRecords
        icon={icon}
        title={title}
        note={note}
        items={items}
        row={propertyRow}
        onOpen={(property) => open('Properties', property)}
      />
    );
  if (!linked.length && !nearby.length) return null;
  return (
    <div className="related-record-sections">
      {section('Linked properties', 'home', linked)}
      {section(
        'Properties in this building',
        'building',
        nearby,
        String(get(contact, 'Building / project') ?? '').trim(),
      )}
    </div>
  );
}
