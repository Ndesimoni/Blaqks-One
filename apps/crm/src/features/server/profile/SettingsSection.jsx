import React from 'react';

/**
 * One settings row: the section title and a one-line description beside (desktop) or above
 * (mobile) its content card. The heading names the region.
 */
export function SettingsSection({ id, title, description, children }) {
  const titleId = `profile-${id}-title`;
  return (
    <section className="acct-row" aria-labelledby={titleId}>
      <div className="acct-row-intro">
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="acct-row-body">{children}</div>
    </section>
  );
}
