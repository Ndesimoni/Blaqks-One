import React, { useId } from 'react';
import { OverflowList } from '../../components/ui/OverflowList.jsx';

export function MessageFields({ form, change, errors, greeting = 'there' }) {
  const id = useId();
  return (
    <div className="team-fields">
      {form.channel === 'email' && (
        <div className="field team-field">
          <label htmlFor={`${id}-subject`}>Subject *</label>
          <input
            id={`${id}-subject`}
            value={form.subject}
            aria-invalid={Boolean(errors.subject)}
            aria-describedby={errors.subject ? `${id}-subject-error` : undefined}
            onChange={(event) => change('subject', event.target.value)}
          />
          {errors.subject && (
            <p className="field-error" id={`${id}-subject-error`}>
              {errors.subject}
            </p>
          )}
        </div>
      )}
      <div className="field team-field">
        <label htmlFor={`${id}-body`}>Message *</label>
        <textarea
          id={`${id}-body`}
          rows={6}
          value={form.body}
          aria-invalid={Boolean(errors.body)}
          aria-describedby={errors.body ? `${id}-body-error` : undefined}
          onChange={(event) => change('body', event.target.value)}
          placeholder={`Hello ${greeting},`}
        />
        {errors.body && (
          <p className="field-error" id={`${id}-body-error`}>
            {errors.body}
          </p>
        )}
      </div>
    </div>
  );
}

export function MessageReview({ form, sender, recipientName, recipients }) {
  return (
    <div className="message-preview">
      <span className="team-preview-label">PREVIEW ONLY · NOT SENT</span>
      <strong>{recipientName}</strong>
      {recipients && (
        <div className="message-recipient-review">
          <span>
            {form.channel === 'email' ? 'Email' : 'WhatsApp'} · {recipients.length}{' '}
            {recipients.length === 1 ? 'recipient' : 'recipients'}
          </span>
          <OverflowList
            items={recipients}
            getKey={(address) => address}
            mode="scroll"
            className="recipient-review-list"
            label="Reviewed recipients"
            listClassName="message-recipient-review-list"
            renderItem={(address) => address}
          />
        </div>
      )}
      {form.channel === 'email' && <h3>{form.subject}</h3>}
      <p>{form.body}</p>
      <small>Planned sender: {sender} · Connection required</small>
      {recipients?.length > 1 && (
        <small>
          Individual delivery planned: the same message goes separately to each recipient.
        </small>
      )}
    </div>
  );
}
