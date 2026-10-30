import React, { useId, useState } from 'react';
import { DEMO_PASSWORD } from '../../config/demoAccounts.js';
import { OWNER_ROLE, defaultChannelAccess, permissionFields } from '../../config/team.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';

export function TeamField({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  required = false,
  readOnly = false,
  hint,
  autoComplete,
  placeholder,
}) {
  const id = useId();
  return (
    <div className="field team-field">
      <label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value || ''}
        autoComplete={autoComplete}
        readOnly={readOnly}
        required={required}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function PersonFields({
  form,
  change,
  errors,
  phone = true,
  phoneRequired = true,
  readOnlyEmail = false,
}) {
  return (
    <div className="team-fields">
      <TeamField
        label="Full name"
        name="name"
        required
        value={form.name}
        error={errors.name}
        onChange={(value) => change('name', value)}
        autoComplete="name"
      />
      <TeamField
        label="Email address"
        name="email"
        required
        type="email"
        value={form.email}
        error={errors.email}
        readOnly={readOnlyEmail}
        onChange={(value) => change('email', value)}
        autoComplete="email"
        hint={readOnlyEmail ? 'This invitation belongs to this email address.' : undefined}
      />
      {phone && (
        <>
          <TeamField
            label="Phone number"
            name="phone"
            required={phoneRequired}
            type="tel"
            value={form.phone}
            error={errors.phone}
            onChange={(value) => change('phone', value)}
            autoComplete="tel"
            placeholder="+971 50 123 4567"
            hint="Include your country code. Your number is required before account activation."
          />
          <label className="team-check">
            <input
              type="checkbox"
              checked={Boolean(form.whatsappUpdates)}
              onChange={(event) => change('whatsappUpdates', event.target.checked)}
            />
            <span>
              <strong>Receive work updates on WhatsApp</strong>
              <small>
                Use this number for staff messages and reminders when messaging is connected.
              </small>
            </span>
          </label>
        </>
      )}
    </div>
  );
}

export function PasswordFields({ form, change, errors }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="team-fields">
      <div className="team-notice">
        <Icon name="info" size={18} />
        <p>
          Use the public demo password <code>{DEMO_PASSWORD}</code>. Real passwords will be created
          when authentication is connected.
        </p>
      </div>
      <TeamField
        label="Create password"
        name="password"
        required
        type={visible ? 'text' : 'password'}
        value={form.password}
        error={errors.password}
        onChange={(value) => change('password', value)}
        autoComplete="off"
      />
      <TeamField
        label="Confirm password"
        name="confirmPassword"
        required
        type={visible ? 'text' : 'password'}
        value={form.confirmPassword}
        error={errors.confirmPassword}
        onChange={(value) => change('confirmPassword', value)}
        autoComplete="off"
      />
      <button type="button" className="team-text-button" onClick={() => setVisible(!visible)}>
        {visible ? 'Hide passwords' : 'Show passwords'}
      </button>
    </div>
  );
}

export function RoleSummary({ role, channelAccess }) {
  return (
    <div className="team-access-summary">
      <strong>
        <Icon name="shield" size={16} /> {role?.name || 'Choose a role'}
      </strong>
      <p>{role?.description}</p>
      <OverflowList
        items={permissionFields}
        getKey={(item) => item.key}
        label="Role permissions"
        renderItem={({ key, label }) => (
          <>
            <Icon name={role?.permissions[key] ? 'check' : 'close'} size={14} /> {label}
            <small>{role?.permissions[key] ? 'Allowed' : 'Restricted'}</small>
          </>
        )}
      />
      {channelAccess && (
        <div className="team-channel-summary">
          <span>
            Client WhatsApp <b>{channelAccess.whatsapp ? 'Allowed' : 'Not allowed'}</b>
          </span>
          <span>
            Client email <b>{channelAccess.email ? 'Allowed' : 'Not allowed'}</b>
          </span>
        </div>
      )}
    </div>
  );
}

export function RoleAccessFields({ team, form, change, locked = false }) {
  const role = team.roles.find((entry) => entry.id === form.roleId);
  return (
    <div className="team-fields">
      <div className="field team-field">
        <label htmlFor="team-role-choice">Assigned role</label>
        <select
          id="team-role-choice"
          value={form.roleId}
          disabled={locked}
          onChange={(event) => {
            change('roleId', event.target.value);
            change('channelAccess', defaultChannelAccess(event.target.value));
          }}
        >
          {team.roles
            .filter((entry) => locked || entry.id !== OWNER_ROLE)
            .map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
        </select>
      </div>
      <RoleSummary role={role} />
      <div className="team-notice">
        <Icon name="shield" size={18} />
        <p>
          Each member has a private CRM workspace. Roles choose which sections they can use within
          it. Only the Super Admin can open other members’ workspaces.
        </p>
      </div>
      <div className="team-form-section">
        <h4>Client messaging permissions</h4>
        <p>
          Grant each channel separately. A connected sender account is also needed for live sending.
        </p>
        {['whatsapp', 'email'].map((key) => (
          <label className="team-check" key={key}>
            <input
              type="checkbox"
              disabled={locked}
              checked={Boolean(form.channelAccess[key])}
              onChange={(event) =>
                change('channelAccess', { ...form.channelAccess, [key]: event.target.checked })
              }
            />
            <span>
              <strong>
                {key === 'whatsapp'
                  ? 'Send WhatsApp messages to clients'
                  : 'Send emails to clients'}
              </strong>
              <small>
                {key === 'whatsapp'
                  ? 'Use the connected business WhatsApp sender.'
                  : 'Use this member’s authorized email account.'}
              </small>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function PersonReview({ form, team, owner = false, invitation = false }) {
  const role = team.roles.find((entry) => entry.id === (owner ? OWNER_ROLE : form.roleId));
  return (
    <div className="team-fields">
      <dl className="team-review">
        <div>
          <dt>Name</dt>
          <dd>{form.name}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{form.email}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{form.phone || 'Required when the member activates their invitation'}</dd>
        </div>
        {form.phone && (
          <div>
            <dt>WhatsApp work updates</dt>
            <dd>{form.whatsappUpdates ? 'Enabled when messaging connects' : 'Not enabled'}</dd>
          </div>
        )}
      </dl>
      <RoleSummary role={role} channelAccess={form.channelAccess} />
      <div className="team-notice">
        <Icon name="info" size={18} />
        <p>
          {invitation
            ? 'This creates an invitation preview in this browser. No invitation email or WhatsApp message will be sent.'
            : 'This is a frontend account preview. Passwords are not saved, and live authentication is not connected.'}
        </p>
      </div>
    </div>
  );
}
