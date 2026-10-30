import React from 'react';
import { MarketplaceAcceptTerms } from './MarketplaceAcceptTerms.jsx';
import { MarketplaceLeave } from './MarketplaceLeave.jsx';

/** The two confirmations on the member's own screen: a newer terms version, and leaving. */
export function MarketplaceMineDialogs({ dialog, terms, busy, error, onClose, onAccept, onLeave }) {
  if (dialog === 'terms' && terms)
    return (
      <MarketplaceAcceptTerms
        terms={terms}
        busy={busy === 'terms'}
        error={error}
        onClose={onClose}
        onAccept={onAccept}
      />
    );
  if (dialog === 'leave')
    return (
      <MarketplaceLeave busy={busy === 'leave'} error={error} onClose={onClose} onLeave={onLeave} />
    );
  return null;
}
