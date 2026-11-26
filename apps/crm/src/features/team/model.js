import { demoAdmins, DEMO_PASSWORD } from '../../config/demoAccounts.js';
import {
  builtInRoles,
  defaultChannelAccess,
  INVITATION_DAYS,
  OWNER_ROLE,
  permissionFields,
  routePermissions,
} from '../../config/team.js';

const statuses = ['active', 'invited', 'suspended', 'revoked'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const stamp = (now) => new Date(now).toISOString();
const expiry = (now) => stamp(now + INVITATION_DAYS * 86400000);
export const normalizeEmail = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();
export const normalizePhone = (value) =>
  String(value || '')
    .trim()
    .replace(/[\s().-]/g, '')
    .replace(/^00/, '+');
export const validPhone = (value) => /^\+[1-9]\d{7,14}$/.test(normalizePhone(value));
export const memberStatus = (member, now = Date.now()) =>
  member.status === 'invited' && Date.parse(member.inviteExpiresAt) <= now
    ? 'expired'
    : member.status;

export function initialTeam() {
  return {
    version: 1,
    configured: false,
    roles: structuredClone(builtInRoles),
    members: demoAdmins.map((admin) => ({
      ...admin,
      phone: '',
      roleId: 'admin',
      status: 'active',
      whatsappUpdates: false,
      channelAccess: defaultChannelAccess('admin'),
      inviteRevision: 0,
      resetRevision: 0,
      emailRevision: 0,
    })),
  };
}

export function memberProfile(team, id) {
  const member = team.members.find((entry) => entry.id === id && entry.status === 'active');
  const role = team.roles.find((entry) => entry.id === member?.roleId);
  if (!member || !role) return null;
  return {
    ...member,
    role: role.name,
    permissions: { ...role.permissions },
    managesTeam: member.roleId === OWNER_ROLE,
  };
}

export function canVisit(profile, route) {
  if (!profile) return false;
  if (route === 'Team & access') return profile.managesTeam;
  if (route === 'Workspaces') return profile.managesTeam;
  const required = routePermissions[route];
  return !required || Boolean(profile.permissions[required]);
}

export function validatePerson(form, members = [], { phoneRequired = true, excludeId } = {}) {
  const errors = {};
  if (!String(form.name || '').trim()) errors.name = 'Enter a full name.';
  const email = normalizeEmail(form.email);
  if (!emailPattern.test(email)) errors.email = 'Enter a valid email address.';
  else if (
    members.some(
      (member) =>
        member.id !== excludeId && (member.email === email || member.pendingEmail?.value === email),
    )
  )
    errors.email = 'This email is already used by another member.';
  if (phoneRequired && !validPhone(form.phone))
    errors.phone = 'Enter a phone number with its country code, for example +971 50 123 4567.';
  else if (form.phone && !validPhone(form.phone))
    errors.phone = 'Include a valid country code and phone number.';
  return errors;
}

export function validateDemoPassword(form) {
  const errors = {};
  if (form.password !== DEMO_PASSWORD)
    errors.password = `Use the public demo password ${DEMO_PASSWORD} for this preview.`;
  if (!form.confirmPassword || form.confirmPassword !== form.password)
    errors.confirmPassword = 'The passwords must match.';
  return errors;
}

function requireValid(errors) {
  if (Object.keys(errors).length) {
    const error = Error('Check the highlighted fields.');
    error.fields = errors;
    throw error;
  }
}
function requireOwner(team, actorId) {
  if (!memberProfile(team, actorId)?.managesTeam)
    throw Error('Only the Super Admin can manage the team and roles.');
}
function findMember(team, id) {
  const member = team.members.find((entry) => entry.id === id);
  if (!member) throw Error('This team member could not be found.');
  return member;
}
function update(team, id, values) {
  return {
    ...team,
    members: team.members.map((member) => (member.id === id ? { ...member, ...values } : member)),
  };
}
function channels(value) {
  return { whatsapp: value?.whatsapp === true, email: value?.email === true };
}

export function setupOwner(team, form, id, now = Date.now()) {
  if (team.configured) throw Error('The workspace already has a Super Admin.');
  const matching = team.members.find((member) => member.email === normalizeEmail(form.email));
  const ownerId = matching?.id || id;
  requireValid({
    ...validatePerson(form, team.members, { excludeId: ownerId }),
    ...validateDemoPassword(form),
  });
  const owner = {
    id: ownerId,
    name: form.name.trim(),
    email: normalizeEmail(form.email),
    phone: normalizePhone(form.phone),
    roleId: OWNER_ROLE,
    status: 'active',
    whatsappUpdates: Boolean(form.whatsappUpdates),
    channelAccess: defaultChannelAccess(OWNER_ROLE),
    inviteRevision: 0,
    resetRevision: 0,
    emailRevision: 0,
    joinedAt: stamp(now),
  };
  const others = team.members
    .filter((member) => member.id !== ownerId)
    .map((member) =>
      member.phone
        ? member
        : {
            ...member,
            status: 'invited',
            inviteRevision: member.inviteRevision + 1,
            inviteExpiresAt: expiry(now),
          },
    );
  return { team: { ...team, configured: true, members: [owner, ...others] }, memberId: ownerId };
}

export function inviteMember(team, actorId, form, id, now = Date.now()) {
  requireOwner(team, actorId);
  if (team.members.length >= 100) throw Error('This preview supports up to 100 members.');
  requireValid(validatePerson(form, team.members, { phoneRequired: false }));
  if (!team.roles.some((role) => role.id === form.roleId && role.id !== OWNER_ROLE))
    throw Error('Choose an available team role.');
  if (team.members.some((member) => member.id === id))
    throw Error('This member ID is already in use.');
  const member = {
    id,
    name: form.name.trim(),
    email: normalizeEmail(form.email),
    phone: '',
    roleId: form.roleId,
    status: 'invited',
    whatsappUpdates: false,
    channelAccess: channels(form.channelAccess),
    inviteRevision: 1,
    inviteExpiresAt: expiry(now),
    invitedAt: stamp(now),
    resetRevision: 0,
    emailRevision: 0,
  };
  return { team: { ...team, members: [...team.members, member] }, memberId: id };
}

export function previewLink(kind, member) {
  const revision =
    kind === 'invite'
      ? member.inviteRevision
      : kind === 'reset'
        ? member.resetRevision
        : member.emailRevision;
  return `/${kind}-preview?id=${encodeURIComponent(member.id)}&revision=${revision}`;
}

export function checkPreview(team, kind, id, revision, now = Date.now()) {
  if (!['invite', 'reset', 'email'].includes(kind))
    throw Error('This account preview is unavailable.');
  const member = team.members.find((entry) => entry.id === id);
  const expected =
    kind === 'invite'
      ? member?.inviteRevision
      : kind === 'reset'
        ? member?.resetRevision
        : member?.emailRevision;
  const expires =
    kind === 'invite'
      ? member?.inviteExpiresAt
      : kind === 'reset'
        ? member?.resetExpiresAt
        : member?.pendingEmail?.expiresAt;
  const available = kind === 'invite' ? member?.status === 'invited' : member?.status === 'active';
  if (
    !member ||
    !available ||
    !expected ||
    String(expected) !== String(revision) ||
    !expires ||
    !Number.isFinite(Date.parse(expires)) ||
    Date.parse(expires) <= now
  )
    throw Error(
      'This preview link has expired or is no longer available. Ask your Super Admin for a new link.',
    );
  return member;
}

export function activateMember(team, id, revision, form, now = Date.now()) {
  const member = checkPreview(team, 'invite', id, revision, now);
  requireValid({
    ...validatePerson({ ...form, email: member.email }, team.members, { excludeId: id }),
    ...validateDemoPassword(form),
  });
  return update(team, id, {
    name: form.name.trim(),
    phone: normalizePhone(form.phone),
    whatsappUpdates: Boolean(form.whatsappUpdates),
    status: 'active',
    joinedAt: stamp(now),
    inviteRevision: member.inviteRevision + 1,
    inviteExpiresAt: null,
  });
}

export function renewInvitation(team, actorId, id, revoke = false, now = Date.now()) {
  requireOwner(team, actorId);
  const member = findMember(team, id);
  if (!['invited', 'revoked'].includes(member.status))
    throw Error('Only pending invitations can be changed.');
  return update(team, id, {
    status: revoke ? 'revoked' : 'invited',
    inviteRevision: member.inviteRevision + 1,
    inviteExpiresAt: revoke ? null : expiry(now),
  });
}

export function setMemberStatus(team, actorId, id, status) {
  requireOwner(team, actorId);
  const member = findMember(team, id);
  if (member.roleId === OWNER_ROLE)
    throw Error('Transfer ownership before changing the Super Admin’s access.');
  if (!['active', 'suspended'].includes(status) || !['active', 'suspended'].includes(member.status))
    throw Error('Activate this invitation before changing access.');
  return update(team, id, { status });
}

export function editMember(team, actorId, id, form, now = Date.now()) {
  const member = findMember(team, id);
  const actor = memberProfile(team, actorId);
  if (!actor) throw Error('Sign in to an active account before editing a profile.');
  const owner = actor.managesTeam;
  if (!owner && actorId !== id) throw Error('You can only edit your own profile.');
  requireValid(
    validatePerson(form, team.members, {
      excludeId: id,
      phoneRequired: ['active', 'suspended'].includes(member.status),
    }),
  );
  if (
    owner &&
    member.roleId !== OWNER_ROLE &&
    !team.roles.some((role) => role.id === form.roleId && role.id !== OWNER_ROLE)
  )
    throw Error('Choose an available team role.');
  const requestedEmail = normalizeEmail(form.email);
  const isPending =
    ['active', 'suspended'].includes(member.status) && requestedEmail !== member.email;
  const values = {
    name: form.name.trim(),
    phone: normalizePhone(form.phone),
    whatsappUpdates: Boolean(form.whatsappUpdates),
  };
  if (owner && member.roleId !== OWNER_ROLE)
    Object.assign(values, { roleId: form.roleId, channelAccess: channels(form.channelAccess) });
  if (isPending)
    Object.assign(values, {
      emailRevision: member.emailRevision + 1,
      pendingEmail: { value: requestedEmail, expiresAt: expiry(now) },
    });
  else if (requestedEmail === member.email) values.pendingEmail = null;
  else
    Object.assign(values, {
      email: requestedEmail,
      inviteRevision: member.inviteRevision + 1,
      inviteExpiresAt: expiry(now),
    });
  return update(team, id, values);
}

export function verifyEmail(team, id, revision, now = Date.now()) {
  const member = checkPreview(team, 'email', id, revision, now);
  if (
    team.members.some(
      (other) =>
        other.id !== id &&
        (other.email === member.pendingEmail.value ||
          other.pendingEmail?.value === member.pendingEmail.value),
    )
  )
    throw Error('This email is already used by another member.');
  return update(team, id, {
    email: member.pendingEmail.value,
    pendingEmail: null,
    emailRevision: member.emailRevision + 1,
  });
}

export function requestReset(team, actorId, id, now = Date.now()) {
  if (actorId !== id) requireOwner(team, actorId);
  const member = findMember(team, id);
  if (member.status !== 'active') throw Error('Only active members can preview a password reset.');
  return update(team, id, { resetRevision: member.resetRevision + 1, resetExpiresAt: expiry(now) });
}

export function finishReset(team, id, revision, form, now = Date.now()) {
  const member = checkPreview(team, 'reset', id, revision, now);
  requireValid(validateDemoPassword(form));
  return update(team, id, { resetRevision: member.resetRevision + 1, resetExpiresAt: null });
}

export function saveRole(team, actorId, form, id) {
  requireOwner(team, actorId);
  const existing = team.roles.find((role) => role.id === id);
  if (existing?.builtIn)
    throw Error('Built-in roles are templates. Create a custom role to change access.');
  const name = String(form.name || '').trim();
  if (!name) throw Error('Enter a role name.');
  if (team.roles.some((role) => role.id !== id && role.name.toLowerCase() === name.toLowerCase()))
    throw Error('This role name is already in use.');
  const permissions = Object.fromEntries(
    permissionFields.map(({ key }) => [key, form.permissions?.[key] === true]),
  );
  const role = {
    id,
    name,
    description: String(form.description || '').trim(),
    permissions,
    builtIn: false,
  };
  if (!existing && team.roles.length >= 50) throw Error('This preview supports up to 50 roles.');
  return {
    ...team,
    roles: existing
      ? team.roles.map((entry) => (entry.id === id ? role : entry))
      : [...team.roles, role],
  };
}

export function removeRole(team, actorId, id) {
  requireOwner(team, actorId);
  const role = team.roles.find((entry) => entry.id === id);
  if (!role || role.builtIn) throw Error('Built-in roles cannot be removed.');
  if (team.members.some((member) => member.roleId === id))
    throw Error('Assign another role to these members before removing this role.');
  return { ...team, roles: team.roles.filter((entry) => entry.id !== id) };
}

export function transferOwnership(team, actorId, id) {
  requireOwner(team, actorId);
  const member = findMember(team, id);
  if (id === actorId || member.status !== 'active' || !validPhone(member.phone))
    throw Error('Choose another active member with a valid phone number.');
  return {
    ...team,
    members: team.members.map((entry) =>
      entry.id === actorId
        ? { ...entry, roleId: 'admin' }
        : entry.id === id
          ? { ...entry, roleId: OWNER_ROLE, channelAccess: defaultChannelAccess(OWNER_ROLE) }
          : entry,
    ),
  };
}

export function validateTeam(value) {
  if (
    !value ||
    value.version !== 1 ||
    typeof value.configured !== 'boolean' ||
    !Array.isArray(value.roles) ||
    !Array.isArray(value.members) ||
    value.roles.length > 50 ||
    value.members.length > 100
  )
    throw Error('The saved team preview could not be opened.');
  const roleIds = new Set();
  const roleNames = new Set();
  for (const role of value.roles) {
    if (
      !role ||
      typeof role.id !== 'string' ||
      !role.id ||
      typeof role.name !== 'string' ||
      !role.name.trim() ||
      roleIds.has(role.id) ||
      roleNames.has(role.name.trim().toLowerCase()) ||
      typeof role.builtIn !== 'boolean' ||
      !permissionFields.every(({ key }) => typeof role.permissions?.[key] === 'boolean')
    )
      throw Error('The saved role configuration is invalid.');
    const template = builtInRoles.find((entry) => entry.id === role.id);
    if (
      template
        ? !role.builtIn ||
          role.name !== template.name ||
          !permissionFields.every(({ key }) => role.permissions[key] === template.permissions[key])
        : role.builtIn
    )
      throw Error('Built-in role templates cannot be changed.');
    roleIds.add(role.id);
    roleNames.add(role.name.trim().toLowerCase());
  }
  if (
    !builtInRoles.every((role) =>
      value.roles.some((entry) => entry.id === role.id && entry.builtIn),
    )
  )
    throw Error('The saved team is missing its role templates.');
  const ids = new Set(),
    emails = new Set();
  for (const member of value.members) {
    if (
      !member ||
      typeof member.id !== 'string' ||
      !member.id ||
      ids.has(member.id) ||
      typeof member.name !== 'string' ||
      !member.name.trim() ||
      !emailPattern.test(member.email) ||
      member.email !== normalizeEmail(member.email) ||
      emails.has(member.email) ||
      !roleIds.has(member.roleId) ||
      !statuses.includes(member.status) ||
      typeof member.phone !== 'string' ||
      typeof member.whatsappUpdates !== 'boolean' ||
      !['whatsapp', 'email'].every((key) => typeof member.channelAccess?.[key] === 'boolean') ||
      !['inviteRevision', 'resetRevision', 'emailRevision'].every(
        (key) => Number.isSafeInteger(member[key]) && member[key] >= 0,
      )
    )
      throw Error('The saved team member details are invalid.');
    if (
      (member.phone && !validPhone(member.phone)) ||
      (value.configured &&
        ['active', 'suspended'].includes(member.status) &&
        !validPhone(member.phone))
    )
      throw Error('An active member is missing a valid phone number.');
    if (
      member.pendingEmail &&
      (!emailPattern.test(member.pendingEmail.value) ||
        member.pendingEmail.value !== normalizeEmail(member.pendingEmail.value) ||
        member.pendingEmail.value === member.email ||
        !member.emailRevision ||
        !Number.isFinite(Date.parse(member.pendingEmail.expiresAt)))
    )
      throw Error('A pending email change is invalid.');
    if (
      member.status === 'invited' &&
      (!member.inviteRevision || !Number.isFinite(Date.parse(member.inviteExpiresAt)))
    )
      throw Error('A pending invitation is invalid.');
    if (
      ['inviteExpiresAt', 'resetExpiresAt', 'joinedAt', 'invitedAt'].some(
        (key) => member[key] != null && !Number.isFinite(Date.parse(member[key])),
      )
    )
      throw Error('The saved account dates are invalid.');
    ids.add(member.id);
    emails.add(member.email);
  }
  for (const member of value.members) {
    if (!member.pendingEmail) continue;
    if (emails.has(member.pendingEmail.value)) throw Error('A pending email is already in use.');
    emails.add(member.pendingEmail.value);
  }
  const owners = value.members.filter((member) => member.roleId === OWNER_ROLE);
  if (value.configured ? owners.length !== 1 || owners[0].status !== 'active' : owners.length !== 0)
    throw Error('The workspace must have exactly one active Super Admin.');
  // Persist only known profile/access fields. Passwords and provider tokens never enter this store.
  const memberKeys = [
    'id',
    'name',
    'email',
    'phone',
    'roleId',
    'status',
    'whatsappUpdates',
    'channelAccess',
    'inviteRevision',
    'inviteExpiresAt',
    'invitedAt',
    'joinedAt',
    'resetRevision',
    'resetExpiresAt',
    'emailRevision',
    'pendingEmail',
  ];
  return {
    version: 1,
    configured: value.configured,
    roles: value.roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: String(role.description || ''),
      builtIn: role.builtIn,
      permissions: Object.fromEntries(
        permissionFields.map(({ key }) => [key, role.permissions[key]]),
      ),
    })),
    members: value.members.map((member) =>
      Object.fromEntries(
        memberKeys
          .filter((key) => member[key] !== undefined)
          .map((key) => [
            key,
            key === 'channelAccess'
              ? channels(member[key])
              : key === 'pendingEmail' && member[key]
                ? { value: member[key].value, expiresAt: member[key].expiresAt }
                : key === 'phone'
                  ? normalizePhone(member[key])
                  : member[key],
          ]),
      ),
    ),
  };
}
