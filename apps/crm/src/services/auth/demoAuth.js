import { demoAdmins, DEMO_PASSWORD } from '../../config/demoAccounts.js';
import { memberProfile } from '../../features/team/model.js';

export function demoAdminProfile(id) {
  const admin = demoAdmins.find((account) => account.id === id);
  return admin ? { ...admin, role: 'Admin' } : null;
}

export function validateSignIn(email, password) {
  const errors = {};
  if (!email.trim()) errors.email = 'Enter your email address.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

// Replace this adapter with server authentication when the shared backend is ready.
export function signInDemo(email, password) {
  const admin = demoAdmins.find((account) => account.email === email.trim().toLowerCase());
  if (!admin || password !== DEMO_PASSWORD)
    throw Error('Email or password is incorrect. Use one of the demo accounts below.');
  return demoAdminProfile(admin.id);
}

export function signInTeamDemo(team, email, password) {
  const member = team.members.find((account) => account.email === email.trim().toLowerCase());
  if (!member || password !== DEMO_PASSWORD)
    throw Error('Email or password is incorrect. Use the public demo password for this preview.');
  if (member.status === 'invited')
    throw Error('Activate your invitation and add your phone number before signing in.');
  if (member.status !== 'active')
    throw Error('Your account is not active. Contact your Super Admin.');
  const profile = memberProfile(team, member.id);
  if (!profile) throw Error('Your account role is unavailable. Contact your Super Admin.');
  return profile;
}
