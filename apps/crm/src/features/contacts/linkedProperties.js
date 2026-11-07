import { get } from '../../lib/records.js';
import { normalizeBuilding, sameBuilding } from '../properties/buildingContacts.js';

const idOf = (record, label) => String(get(record, label) ?? '').trim();

const byPropertyId = (a, b) =>
  idOf(a, 'Property ID').localeCompare(idOf(b, 'Property ID'), undefined, { numeric: true });

/** Loaded properties whose Contact ID is this contact. */
export function selectLinkedProperties(properties = [], contact) {
  const id = idOf(contact, 'Contact ID');
  if (!id) return [];
  return properties.filter((property) => idOf(property, 'Contact ID') === id).sort(byPropertyId);
}

/** Loaded properties in the contact's Building / project that are not already linked to it. */
export function selectBuildingProperties(properties = [], contact) {
  const building = get(contact, 'Building / project');
  if (!normalizeBuilding(building)) return [];
  const id = idOf(contact, 'Contact ID');
  return properties
    .filter((property) => sameBuilding(building, get(property, 'Building / project')))
    .filter((property) => !id || idOf(property, 'Contact ID') !== id)
    .sort(byPropertyId);
}

/** Property ID, building/community and status/type, skipping blanks and repeated names. */
export function propertySummary(property) {
  const parts = [
    idOf(property, 'Property ID'),
    get(property, 'Building / project'),
    get(property, 'Community'),
    get(property, 'Listing status'),
    get(property, 'Property type'),
  ]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean);
  return parts
    .filter(
      (part, index) =>
        parts.findIndex((other) => normalizeBuilding(other) === normalizeBuilding(part)) === index,
    )
    .join(' · ');
}
