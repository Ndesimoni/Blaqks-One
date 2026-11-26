import React from 'react';

function BrandMark({ small = false }) {
  return (
    <span className={'brand-logo ' + (small ? 'brand-logo-small' : '')}>
      <svg viewBox="0 0 50 50" width="30" height="30" fill="none">
        <path
          d="M12 7v36M12 25 34 8M12 25l24 18"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="37" cy="9" r="4" fill="currentColor" />
      </svg>
    </span>
  );
}

export { BrandMark };
