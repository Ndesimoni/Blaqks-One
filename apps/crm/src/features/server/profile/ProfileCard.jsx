import React from 'react';

/**
 * One settings card as the approved mockup draws them (design queue item 14): its title and a
 * short description at the top, then the content. The title names the region.
 */
export function ProfileCard({ id, title, description, children, wide = false }) {
  const titleId = `profile-${id}-title`;
  return (
    <section className={'panel profile-card' + (wide ? ' wide' : '')} aria-labelledby={titleId}>
      <div className="profile-card-head">
        <h2 id={titleId}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </section>
  );
}
