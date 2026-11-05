import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';

/** Channels the shared icon set already draws. */
const shared = { whatsapp: 'chat', phone: 'phone', mail: 'mail', meeting: 'users', note: 'note' };

/** The remaining channel glyph, on the same 24px grid with round caps as Icon.jsx. */
const own = {
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
