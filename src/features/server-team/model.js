export const accessFields = [
  [
    'relationships',
    'Clients, leads and contacts',
    'Clients and Contacts are connected. Leads are planned.',
  ],
  ['properties', 'Properties', 'Create and manage listings. Publication approval is planned.'],
  ['schedule', 'Scheduling', 'Follow-ups and viewings: backend planned.'],
  ['finance', 'Finance', 'Expenses and commissions: backend planned.'],
  ['reports', 'Reports', 'Team reporting: backend planned.'],
  ['exports', 'Exports', 'Connected exports: planned.'],
];
export const channelFields = [
  ['email', 'Email'],
  ['whatsapp', 'WhatsApp'],
];
export const teamSteps = [
  { id: 'person', title: 'Person' },
  { id: 'access', title: 'Roles & access' },
  { id: 'review', title: 'Review' },
];

export function blankMember(member) {
  return {
    name: member?.name || '',
    email: member?.email || '',
    phone: member?.phone || '',
    positions: [...(member?.positions || [])],
    permissions: Object.fromEntries(
      accessFields.map(([key]) => [key, member?.permissions?.[key] === true]),
    ),
    channelAccess: Object.fromEntries(
      channelFields.map(([key]) => [key, member?.channelAccess?.[key] === true]),
    ),
    active: member?.active === true,
    accountRole: member?.roleId === 'admin' ? 'admin' : 'staff',
  };
}

export function positionDefaults(positions, roles) {
  const selected = roles.filter((role) => positions.includes(role.id));
  return {
    permissions: Object.fromEntries(
      accessFields.map(([key]) => [key, selected.some((role) => role.permissions?.[key])]),
    ),
    channelAccess: Object.fromEntries(
      channelFields.map(([key]) => [key, selected.some((role) => role.channelAccess?.[key])]),
    ),
  };
}

export function memberError(form, step) {
  if (step === 0) {
    if (form.name.trim().length < 2) return 'Enter a full name of at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return 'Enter a valid email address.';
    if (!/^\+[1-9]\d{6,14}$/.test(form.phone.trim()))
      return 'Enter an international phone number, such as +971501234567, without spaces.';
  }
  if (step === 1 && form.accountRole !== 'admin' && !form.positions.length)
    return 'Choose at least one position for this person.';
  return '';
}

export function memberPayload(form, member) {
  const { name, phone, positions, permissions, channelAccess, active } = form;
  if (member)
    return {
      version: member.version,
      name: name.trim(),
      phone: phone.trim(),
      positions,
      permissions,
      channelAccess,
      active,
    };
  return {
    name: name.trim(),
    email: form.email.trim(),
    phone: phone.trim(),
    positions,
    permissions,
    channelAccess,
    accountRole: form.accountRole,
  };
}
