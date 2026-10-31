import React from 'react';
import { MarketplaceRequestFacts } from './MarketplaceRequestFacts.jsx';
import { bandFor } from './requestBands.js';
import { requestBodyOf } from './requestOptions.js';

/** The request the member is about to post, worded exactly as the board will show it (MK2). */
export function MarketplaceRequestReview({ draft }) {
  const request = requestBodyOf(draft);
  const budgetBand = bandFor(request.purpose, request.budgetMaxAed);
  return <MarketplaceRequestFacts request={{ ...request, budgetBand }} />;
}
