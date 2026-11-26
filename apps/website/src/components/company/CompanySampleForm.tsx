'use client';
import { useState } from 'react';

export function CompanySampleForm({
  propertyTitle,
  agentName,
  compact = false,
  actionClass = 'a-action',
}: {
  propertyTitle?: string;
  agentName?: string;
  compact?: boolean;
  actionClass?: string;
} = {}) {
  const [done, setDone] = useState(false);
  if (done)
    return (
      <div className="a-preview-result" role="status">
        <h2>That’s how your enquiry will look.</h2>
        <p>This is a design preview. No message was sent and no information was saved.</p>
        <button className={actionClass} onClick={() => setDone(false)}>
          Back to the form ↗
        </button>
      </div>
    );
  return (
    <form
      className={`public-enquiry-form${compact ? ' v-compact-form' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        setDone(true);
      }}
    >
      <h2>
        {propertyTitle
          ? 'Ask about this property.'
          : agentName
            ? `Contact ${agentName}.`
            : 'A conversation starts here.'}
      </h2>
      {propertyTitle && <p>{propertyTitle}</p>}
      <p className="notice">Design preview · Use sample details. Nothing is sent or saved.</p>
      <div
        className={compact ? 'v-form-pair' : undefined}
        style={compact ? undefined : { display: 'contents' }}
      >
        <label>
          Your name
          <input
            name="name"
            autoComplete="off"
            placeholder="Alex Jordan"
            maxLength={100}
            required
          />
        </label>
        <label>
          Email address
          <input
            name="email"
            type="email"
            autoComplete="off"
            placeholder="alex@example.com"
            maxLength={254}
            required
          />
        </label>
      </div>
      {compact && (
        <label>
          <span>
            Phone number <span className="v-optional">(optional)</span>
          </span>
          <input name="phone" type="tel" autoComplete="off" placeholder="+971…" maxLength={16} />
        </label>
      )}
      {!propertyTitle && !agentName && (
        <>
          <label>
            I’m interested in
            <select name="interest">
              <option>Buying a property</option>
              <option>Renting a property</option>
              <option>Discussing my property</option>
              <option>A general question</option>
            </select>
          </label>
        </>
      )}
      <label>
        Your message
        <textarea
          name="message"
          placeholder="Tell us what you have in mind…"
          rows={compact ? 3 : 5}
          maxLength={4000}
          required
        />
      </label>
      <label className="privacy-choice">
        <input type="checkbox" required />
        <span>I understand this is a preview and nothing will be sent.</span>
      </label>
      <button className={actionClass} type="submit">
        Preview enquiry <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
