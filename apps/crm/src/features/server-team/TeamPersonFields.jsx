import React from 'react';
import { blankMember } from './model.js';

export function TeamPersonFields({ form, change, editing, canInviteAdmin, busy }) {
  return (
    <div className="team-fields">
      <div className="field">
        <label htmlFor="member-name">Full name *</label>
        <input
          id="member-name"
          data-initial-focus
          autoComplete="name"
          required
          minLength={2}
          value={form.name}
          disabled={busy}
          onChange={(event) => change('name', event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="member-email">Email address *</label>
        <input
          id="member-email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          value={form.email}
          disabled={busy || editing}
          onChange={(event) => change('email', event.target.value)}
        />
        {editing && <small>Login email cannot be changed from team management.</small>}
      </div>
      <div className="field">
        <label htmlFor="member-phone">Phone number *</label>
        <input
          id="member-phone"
          type="tel"
          autoComplete="tel"
          required
          pattern="\+[1-9][0-9]{6,14}"
          aria-describedby="member-phone-help"
          value={form.phone}
          disabled={busy}
          onChange={(event) => change('phone', event.target.value)}
        />
        <small id="member-phone-help">Include country code, without spaces: +971501234567.</small>
      </div>
      {canInviteAdmin && !editing && (
        <div className="field">
          <label htmlFor="member-account">Account type</label>
          <select
            id="member-account"
            value={form.accountRole}
            disabled={busy}
            onChange={(event) => {
              const { permissions, actions } = blankMember();
              // Returning to a teammate restarts access, so positions apply fresh presets.
              change(
                'accountRole',
                event.target.value,
                event.target.value === 'staff' ? { permissions, actions } : {},
              );
            }}
          >
            <option value="staff">Teammate in this workspace</option>
            <option value="admin">Admin with a separate workspace</option>
          </select>
          <small>Only the Super Admin can create Admin accounts.</small>
        </div>
      )}
    </div>
  );
}
