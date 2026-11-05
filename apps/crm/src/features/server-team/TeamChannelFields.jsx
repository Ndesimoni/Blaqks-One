import React from 'react';
import { channelFields } from './model.js';

export function TeamChannelFields({ form, change, busy }) {
  return (
    <fieldset className="connected-team-options">
      <legend>Messaging permissions</legend>
      <p>Permissions prepare future connections. Messages cannot be sent yet.</p>
      {channelFields.map(([key, label]) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={form.channelAccess[key]}
            disabled={busy}
            onChange={(event) =>
              change('channelAccess', { ...form.channelAccess, [key]: event.target.checked })
            }
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
