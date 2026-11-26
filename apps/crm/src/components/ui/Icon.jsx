import React from 'react';
import { accountIcons } from './icons/accountIcons.jsx';
import { actionIcons } from './icons/actionIcons.jsx';
import { contentIcons } from './icons/contentIcons.jsx';
import { navigationIcons } from './icons/navigationIcons.jsx';

/** Every named icon; the category modules keep each path set within the file-size limit. */
const icons = { ...navigationIcons, ...actionIcons, ...contentIcons, ...accountIcons };

function Icon({ name, size = 18, strokeWidth = 1.8, className = '', ...rest }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {icons[name] || icons.grid}
    </svg>
  );
}

export { icons, Icon };
