import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { requestTags } from './requestText.js';

/**
 * A request's areas and stated preferences, compact enough for a card: the communities on one
 * line, then a tag per preference (ready or off-plan, furnishing, building age, cheques,
 * move-in month, open to other areas). Choices left at "any" add no tag.
 */
export function MarketplaceRequestTags({ request }) {
  const { t } = useI18n();
  const tags = requestTags(t, request);
  return (
    <>
      {request.communities.length > 0 && (
        <p className="market-areas">
          <Icon name="pin" size={15} />
          <span>
            <span className="sr-only">{t('marketplaceRequests.post.communities')}: </span>
            {request.communities.join(', ')}
          </span>
        </p>
      )}
      {tags.length > 0 && (
        <ul className="market-tags">
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
    </>
  );
}
