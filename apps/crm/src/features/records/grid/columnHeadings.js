/**
 * The approved mockup's column headings where they differ from the workbook's field names. The
 * workbook names stay in imports, exports, sorting and the record editor.
 */
const headings = {
  Clients: { 'Full name': 'Client', 'Last contact auto': 'Last contact' },
  Contacts: { 'Full name': 'Contact', 'Contact type': 'Role', 'Building / project': 'Linked to' },
  Shortlist: {
    'Client name auto': 'Client',
    'Property title auto': 'Property',
    'Client response': 'Status',
  },
  Leads: {
    'Full name': 'Lead',
    'Maximum budget AED': 'Budget',
    'Lead stage': 'Stage',
    'Lead source': 'Source',
  },
  Properties: {
    'Listing title': 'Property',
    'Price / annual rent AED': 'Price',
    'Listing status': 'Status',
  },
  Viewings: {
    'Appointment date & time': 'When',
    'Property title auto': 'Viewing',
    'Client name auto': 'Client',
  },
  'Client care': {
    'Client name auto': 'Client',
    'Touchpoint type': 'Occasion',
    'Next contact': 'Due',
    'Task status': 'Status',
  },
};

/** A grid column's heading; amounts drop the " AED" their sheet name ends with. */
export const columnHeading = (module, name) =>
  headings[module]?.[name] ?? name.replace(/ AED$/, '');
