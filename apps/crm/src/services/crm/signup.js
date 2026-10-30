/** Public sign-up plus the session handoff created by successful verification. */
export function signupRoutes({ request, setCsrfToken }) {
  return {
    signupStatus: (signal) => request('/signup/status', { signal }),
    signupStart: (body) => request('/signup/start', { method: 'POST', body }),
    signupResend: (requestId, botToken) =>
      request('/signup/resend', { method: 'POST', body: { requestId, botToken } }),
    async signupVerify(requestId, code) {
      const result = await request('/signup/verify', {
        method: 'POST',
        body: { requestId, code },
      });
      if (!result.user?.id || !result.company || !result.csrfToken)
        throw Error('The account response was incomplete. Try signing in.');
      setCsrfToken(result.csrfToken);
      return { user: result.user, company: result.company };
    },
  };
}
