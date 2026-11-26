/**
 * The record slider's quick action (approved mockup): Convert to deal for a client or lead,
 * Add a property for a contact, when `allowed.deal` or `allowed.property` says the person may.
 */
export function quickAction(module, record, allowed) {
  if (module === 'Clients' && allowed.deal && record?.client_id)
    return {
      kind: 'deal',
      label: 'recordPanel.convertToDeal',
      icon: 'briefcase',
      clientId: record.client_id,
    };
  if (module === 'Contacts' && allowed.property && record?.contact_id)
    return {
      kind: 'property',
      label: 'recordPanel.addProperty',
      icon: 'plus',
      defaults: { contact_id: record.contact_id },
    };
  return null;
}
