import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';

/** Channels the shared icon set already draws. */
const shared = { whatsapp: 'chat', meeting: 'users', note: 'note' };

/** The remaining channel glyphs, on the same 24px grid with round caps as Icon.jsx. */
const own = {
  phone: (
    <path d="M6.5 3.5h3l1.5 4.5-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A17 17 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  sms: (
    <>
      <path d="M4 5h16v11h-9l-5 4v-4H4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
};

/** A conversation's channel as decoration; the channel name is always written beside it. */
export function ChannelIcon({ kind, size = 18 }) {
  if (!own[kind]) return <Icon name={shared[kind] || 'note'} size={size} />;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {own[kind]}
    </svg>
  );
}
