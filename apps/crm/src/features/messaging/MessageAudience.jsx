import React, { useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { RecipientPicker } from './RecipientPicker.jsx';
import { recipientDirectory } from './recipients.js';
import {
  appendRecipient,
  MAX_RECIPIENT_TEXT,
  MAX_RECIPIENTS,
  parseRecipients,
  recipientField,
  removeRecipient,
} from './model.js';

export function MessageAudience({ form, change, errors, user, clients, contacts, client }) {
  const id = useId();
  const [picker, setPicker] = useState(null);
  const browseRef = useRef(null);
  const recipientsRef = useRef(null);
  const field = recipientField(form.channel);
  const parsed = parseRecipients(form[field], form.channel);
  const entries = useMemo(
    () =>
      user.permissions.relationships ? recipientDirectory(clients, contacts, form.channel) : [],
    [clients, contacts, form.channel, user.permissions.relationships],
  );
  const labels = new Map(
    entries.filter((entry) => entry.available).map((entry) => [entry.address, entry.name]),
  );
  const closePicker = () => {
    setPicker(null);
    browseRef.current?.focus();
  };
  return (
    <div className="team-fields">
      {client && (
        <p className="message-client-origin">
          Started from <strong>{client.full_name || client.name || 'this client'}</strong>’s
          profile. You can change the recipient or add others.
        </p>
      )}
      <fieldset
        className="message-channel-choice"
        aria-invalid={Boolean(errors.channel)}
        aria-describedby={errors.channel ? `${id}-channel-error` : undefined}
      >
        <legend>Choose a channel</legend>
        {['whatsapp', 'email'].map((channel) => (
          <label key={channel} className={form.channel === channel ? 'selected' : ''}>
            <input
              type="radio"
              name={`${id}-channel`}
              value={channel}
              checked={form.channel === channel}
              disabled={!user.channelAccess[channel]}
              onChange={() => change('channel', channel)}
            />
            <Icon name={channel === 'email' ? 'note' : 'chat'} size={20} />
            <span>
              <strong>{channel === 'email' ? 'Email' : 'WhatsApp'}</strong>
              <small>
                {user.channelAccess[channel]
                  ? 'Allowed · sender not connected'
                  : 'Not allowed by your Super Admin'}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      {errors.channel && (
        <p className="field-error" id={`${id}-channel-error`}>
          {errors.channel}
        </p>
      )}
      <div
        className="message-recipient-control"
        onBlurCapture={(event) => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
            setPicker(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && picker && user.permissions.relationships) {
            event.preventDefault();
            event.stopPropagation();
            closePicker();
          }
        }}
      >
        <div className="field team-field">
          <label htmlFor={`${id}-recipients`}>
            {form.channel === 'email' ? 'Email recipients' : 'WhatsApp recipients'} *
          </label>
          <textarea
            id={`${id}-recipients`}
            ref={recipientsRef}
            rows={4}
            value={form[field]}
            maxLength={MAX_RECIPIENT_TEXT}
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(errors[field])}
            aria-describedby={`${id}-recipients-hint${errors[field] ? ` ${id}-recipients-error` : ''}`}
            placeholder={
              form.channel === 'email'
                ? 'client@example.com\nsecond@example.com'
                : '+971 50 123 4567\n+971 55 987 6543'
            }
            onChange={(event) => change(field, event.target.value)}
            onFocus={() => user.permissions.relationships && setPicker('field')}
            onClick={() => user.permissions.relationships && setPicker('field')}
          />
          <small id={`${id}-recipients-hint`}>
            Separate recipients with commas, semicolons or new lines.{' '}
            {form.channel === 'whatsapp' ? 'Include a country code for each number. ' : ''}Up to{' '}
            {MAX_RECIPIENTS} recipients per preview.
          </small>
          {errors[field] && (
            <p className="field-error" id={`${id}-recipients-error`}>
              {errors[field]}
            </p>
          )}
          <small role="status">
            {parsed.recipients.length} unique{' '}
            {parsed.recipients.length === 1 ? 'recipient' : 'recipients'}
            {parsed.duplicateCount
              ? ` · ${parsed.duplicateCount} ${parsed.duplicateCount === 1 ? 'duplicate' : 'duplicates'} ignored`
              : ''}
          </small>
        </div>
        {parsed.recipients.length > 0 && (
          <OverflowList
            items={parsed.recipients}
            getKey={(address) => address}
            label="Selected recipients"
            listClassName="message-recipient-chips"
            renderItem={(address) => (
              <>
                <span>
                  {labels.has(address) && <strong>{labels.get(address)}</strong>}
                  <span>{address}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${address}`}
                  onClick={(event) => {
                    const chip = event.currentTarget.closest('li');
                    const next =
                      chip.nextElementSibling?.querySelector('button') ||
                      chip.previousElementSibling?.querySelector('button');
                    (next || browseRef.current || recipientsRef.current)?.focus();
                    change(field, removeRecipient(form[field], address, form.channel));
                  }}
                >
                  <Icon name="close" size={15} />
                </button>
              </>
            )}
          />
        )}
        {user.permissions.relationships && (
          <>
            <button
              type="button"
              ref={browseRef}
              className="btn btn-light message-recipient-browse"
              aria-expanded={Boolean(picker)}
              aria-controls={`${id}-picker`}
              onClick={() => {
                if (picker) closePicker();
                else setPicker('search');
              }}
            >
              <Icon name="users" size={16} />
              <span>{picker ? 'Hide saved recipients' : 'Browse saved recipients'}</span>
            </button>
            {picker && (
              <RecipientPicker
                id={`${id}-picker`}
                entries={entries}
                channel={form.channel}
                selected={parsed.recipients}
                allowed={user.channelAccess[form.channel]}
                focusSearch={picker === 'search'}
                onAdd={(address) =>
                  change(field, appendRecipient(form[field], address, form.channel))
                }
                onClose={closePicker}
              />
            )}
          </>
        )}
      </div>
      <div className="team-notice">
        <Icon name="info" size={18} />
        <p>
          {parsed.recipients.length > 1
            ? 'This previews separate messages to each person, without sharing the recipient list. '
            : ''}
          No messages will be sent. Connect an authorized sender before live delivery.
        </p>
      </div>
    </div>
  );
}
