import React from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { listingShareLinkId } from './listingShareLinks.js';
import { ListingShareDetail } from './ListingShareDetail.jsx';
import './listing-shares.css';

/**
 * The link `#/listing-shares/{id}` (record sharing R2): the named agent, signed in, reviews
 * the listing and accepts or declines it; the sender side and the receiving Admin see their
 * views. Everyone else sees one plain "isn't available" message. Closing opens Agreements.
 */
export function ListingShareLinkPage() {
  const { pathname } = useLocation();
  const { navigate } = useNavigation();
  return (
    <ListingShareDetail id={listingShareLinkId(pathname)} onClose={() => navigate('Agreements')} />
  );
}
