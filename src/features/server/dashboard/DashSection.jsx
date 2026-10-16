import React, { useId } from 'react';

/**
 * A v2 Dashboard bento tile: a label (the section heading), an optional link and caption. The
 * tile is a named region; `regionLabel` overrides its name when a stable landmark name
 * differs from the visible label. `style` carries the tile's placement and stagger.
 */
export function DashSection({
  label,
  caption,
  action,
  regionLabel,
  className = '',
  style,
  children,
}) {
  const id = useId();
  const named = regionLabel ? { 'aria-label': regionLabel } : { 'aria-labelledby': id };
  return (
    <section className={`v2-tile ${className}`} style={style} {...named}>
      <div className="v2-tile-head">
        <h2 id={id} className="v2-label">
          {label}
        </h2>
        {action}
      </div>
      {caption && <p className="v2-caption">{caption}</p>}
      {children}
    </section>
  );
}

/** An accent text link that opens another section; the arrow is decorative. */
export function SectionLink({ children, onClick, arrow = true }) {
  return (
    <button type="button" className="v2-link" onClick={onClick}>
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </button>
  );
}

/** Skeleton lines while a section's data loads; announced once to screen readers. */
export function SectionLoading({ label }) {
  return (
    <div className="v2-skeleton" role="status">
      <span className="sr-only">Loading {label}…</span>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </div>
  );
}

/** A failure that stays inside its section, with a Retry action. */
export function SectionError({ message, onRetry }) {
  return (
    <div className="v2-error">
      <div className="v2-error-text" role="alert">
        {message}
      </div>
      {onRetry && (
        <button type="button" className="v2-btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export const SectionEmpty = ({ children }) => <p className="v2-empty">{children}</p>;
