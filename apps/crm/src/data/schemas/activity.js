import { sheetColumns } from './columns.js';

export const followUpsColumns = sheetColumns([
  'Activity ID',
  'Client ID',
  'Property ID',
  'Contact date',
  'Channel',
  'Outcome / notes',
  'Next action',
  'Due date',
  'Task status',
  'Due-date alert',
  'Client name auto',
  'Property title auto',
  'Record check',
  'Task order auto',
]);

export const viewingsColumns = sheetColumns([
  'Viewing ID',
  'Client ID',
  'Property ID',
  'Appointment date & time',
  'Viewing status',
  'Client feedback',
  'Next action',
  'Client name auto',
  'Property title auto',
  'Record check',
]);

export const shortlistColumns = sheetColumns([
  'Match ID',
  'Client ID',
  'Property ID',
  'Date sent',
  'Client response',
  'Next action',
  'Notes',
  'Client name auto',
  'Property title auto',
  'Record check',
]);

export const interactionLogColumns = sheetColumns([
  'Log ID',
  'Contacted on UAE time',
  'Client ID',
  'Client name auto',
  'Channel',
  'Direction',
  'Conversation topic',
  'Conversation summary / client needs',
  'Objection category',
  'Exact objection / concern',
  'Commitment made',
  'Next action',
  'Action due',
  'Action status',
  'Property ID optional',
  'Deal ID optional',
  'Record check auto',
]);

export const clientCareColumns = sheetColumns([
  'Care ID',
  'Client ID',
  'Client name auto',
  'Touchpoint type',
  'Property ID optional',
  'Last contact',
  'Next contact',
  'Reminder auto',
  'Client relationship',
  'Referral outcome',
  'Referred client ID',
  'Preferences / interests',
  'Conversation notes',
  'Task status',
  'Record check auto',
]);
