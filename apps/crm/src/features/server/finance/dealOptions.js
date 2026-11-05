/**
 * Client and property choices for the deal editor (finance-design §5.4, §13 M-F1). They come
 * from the selected workspace's visible records only. Staff may link only clients they hold;
 * an Admin may choose any visible client. A deal's current link always stays selectable so an
 * edit never silently drops it; the server re-checks every link under its lock.
 */
const byName = (a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id);

/** `[{ id, label }]` clients for this caller, plus the deal's current client. */
export function clientOptions(entries, user, access, currentId = '') {
  const rows = (entries?.Clients ?? []).filter(
    (entry) => access.manage || entry.assignee === user?.id || entry.record.client_id === currentId,
  );
  const options = rows.map((entry) => ({
    id: entry.record.client_id,
    label: entry.record.full_name
      ? `${entry.record.full_name} (${entry.record.client_id})`
      : entry.record.client_id,
  }));
  if (currentId && !options.some((option) => option.id === currentId))
    options.push({ id: currentId, label: `${currentId} (not in your client list)` });
  return options.sort(byName);
}

/** `[{ id, label }]` visible properties, plus the deal's current property. */
export function propertyOptions(entries, currentId = '') {
  const options = (entries?.Properties ?? []).map((entry) => ({
    id: entry.record.property_id,
    label: entry.record.listing_title
      ? `${entry.record.listing_title} (${entry.record.property_id})`
      : entry.record.property_id,
  }));
  if (currentId && !options.some((option) => option.id === currentId))
    options.push({ id: currentId, label: `${currentId} (not in your property list)` });
  return options.sort(byName);
}

/** A label for the review step from the option lists. */
export const optionLabel = (options, id) =>
  options.find((option) => option.id === id)?.label ?? (id || '—');
