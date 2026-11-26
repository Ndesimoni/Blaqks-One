import React from 'react';
import { AuthShell } from '../auth/AuthShell.jsx';

/** Sign-up uses the approved mockup's full-screen split screen, shared with sign-in. */
export function SignupShell({ children, busy }) {
  return <AuthShell busy={busy}>{children}</AuthShell>;
}
