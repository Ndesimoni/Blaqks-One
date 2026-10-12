import { descriptions } from '../../config/navigation.js';

const connectedSections = new Set(['Clients', 'Contacts', 'Properties', 'Team & access']);
export const isConnectedSection = (name) => connectedSections.has(name);

const purposes = {
  Dashboard: 'Review your business priorities and workspace overview.',
  'Client desk': 'Search client requirements and find suitable properties.',
  'CRM insights': 'Review opportunities and understand your CRM activity.',
  'Date search': 'Find workspace records by their dates.',
  Performance: 'Review targets and business performance.',
  Guide: 'Learn how to use your CRM workspace.',
  Workspaces: 'Review the workspaces this account is permitted to open.',
  'Team activity': 'Review changes recorded in the selected workspace.',
};

export function sectionDescription(name) {
  return purposes[name] || descriptions[name] || 'Review your selected workspace.';
}
