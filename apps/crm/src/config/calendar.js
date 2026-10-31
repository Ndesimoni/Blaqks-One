export const CALENDAR_TIME_ZONE = 'Asia/Dubai';
export const CALENDAR_MODULES = ['Follow-ups', 'Viewings'];
export const ACTIVITY_TYPES = ['Follow-up', 'Call', 'Meeting', 'Viewing'];

export function calendarFields(module) {
  if (!CALENDAR_MODULES.includes(module)) return [];
  return [
    { key: 'calendar_enabled', name: 'Sync with Google Calendar', options: ['Yes', 'No'] },
    {
      key: 'calendar_activity',
      name: 'Activity type',
      options: module === 'Viewings' ? ['Viewing'] : ACTIVITY_TYPES,
    },
    ...(module === 'Follow-ups'
      ? [{ key: 'calendar_start', name: 'Starts (Dubai time)', type: 'datetime-local' }]
      : []),
    { key: 'calendar_duration', name: 'Duration (minutes)', type: 'number' },
    { key: 'calendar_reminder', name: 'Reminder (minutes before)', type: 'number' },
    { key: 'calendar_location', name: 'Location / meeting link', type: 'text' },
    { key: 'calendar_invite', name: 'Send invitation to client', options: ['No', 'Yes'] },
  ].map((field) => ({ type: 'text', ...field }));
}

export function calendarDefaults(module) {
  return CALENDAR_MODULES.includes(module)
    ? {
        calendar_enabled: 'Yes',
        calendar_activity: module === 'Viewings' ? 'Viewing' : 'Follow-up',
        calendar_duration: module === 'Viewings' ? '60' : '30',
        calendar_reminder: '15',
        calendar_invite: 'No',
      }
    : {};
}

/** Keep local appointment fields while Google integration is deferred. */
export function localScheduleFields(module) {
  return calendarFields(module).filter(
    (field) => !['calendar_enabled', 'calendar_reminder', 'calendar_invite'].includes(field.key),
  );
}
