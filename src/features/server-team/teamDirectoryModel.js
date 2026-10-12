export const STATUS_LABELS = {
  current: 'All current',
  active: 'Active',
  suspended: 'Suspended',
  pending: 'Invitation pending',
  cancelled: 'Invitation cancelled',
  archived: 'Archived accounts',
};

export function memberStatus(member) {
  if (member.status === 'archived' || member.deletedAt) return 'archived';
  if (member.invitationPending) return member.status === 'invited' ? 'pending' : 'cancelled';
  return member.active ? 'active' : 'suspended';
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export function directoryModel(members, roles, { query, role, status, sort }) {
  const term = query.trim().toLowerCase();
  const digits = term.replace(/[^0-9]/g, '');
  const phoneQuery = digits && /^[+\d\s()-]+$/.test(term);
  const matching = members.filter((member) => {
    const positions = member.positions || [];
    const roleMatch =
      role === 'all' || member.roleId === role || positions.includes(role.replace('position:', ''));
    const names = positions.map((id) => roles.find((entry) => entry.id === id)?.label || id);
    const text = [member.name, member.email, member.phone, ...names].join(' ').toLowerCase();
    const searchMatch = text.includes(term) ||
      (phoneQuery && (member.phone || '').replace(/\D/g, '').includes(digits));
    return roleMatch && searchMatch;
  });
  const counts = Object.fromEntries(Object.keys(STATUS_LABELS).map((key) => [key, 0]));
  matching.forEach((member) => {
    const state = memberStatus(member);
    counts[state] += 1;
    if (state !== 'archived') counts.current += 1;
  });
  const filtered = matching
    .filter((member) => status === 'current'
      ? memberStatus(member) !== 'archived'
      : memberStatus(member) === status)
    .sort((a, b) => {
      const order = collator.compare(a.name, b.name) || collator.compare(a.email, b.email) ||
        collator.compare(a.id, b.id);
      return sort === 'desc' ? -order : order;
    });
  return { filtered, counts };
}
