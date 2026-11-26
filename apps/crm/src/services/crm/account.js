/**
 * Account self-service routes under `/api/crm/auth` (docs/account-self-service.md). Spread
 * `accountRoutes({ request, setCsrfToken })` into `createCrmClient`. A password change rotates
 * the session: the browser stores the new HttpOnly cookie and this swaps the in-memory CSRF
 * token, which is never returned to callers. Passwords are sent once and never kept here.
 */
export function accountRoutes({ request, setCsrfToken }) {
  return {
    account: (signal) => request('/auth/account', { signal }),
    updateAccount: ({ version, name, phone }) =>
      request('/auth/account', { method: 'PATCH', body: { version, name, phone } }),
    // An allowlisted preference ('en' | 'ar'); returns the account like `updateAccount`.
    updateLanguage: (language) =>
      request('/auth/account/language', { method: 'PUT', body: { language } }),
    // Automatic field hints on or off; returns the account like `updateLanguage`.
    updateGuidance: (enabled) =>
      request('/auth/account/guidance', { method: 'PUT', body: { enabled } }),
    async changePassword(currentPassword, newPassword) {
      const result = await request('/auth/account/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      if (typeof result.csrfToken !== 'string' || !result.csrfToken)
        throw Error('The password change could not be confirmed. Sign in again.');
      setCsrfToken(result.csrfToken);
      return { signedOutOthers: Number(result.signedOutOthers) || 0 };
    },
    sessions: (signal) => request('/auth/sessions', { signal }),
    revokeSession: (id) =>
      request(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    revokeOtherSessions: () => request('/auth/sessions/revoke-others', { method: 'POST' }),
  };
}
