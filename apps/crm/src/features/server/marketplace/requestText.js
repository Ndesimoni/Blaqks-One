/**
 * A client request's short wording (marketplace redesign, owner 2026-10-31): the title, the
 * buy-or-rent line and the preference tags shared by board cards, My requests rows and the
 * request slider. Pure, so every place words a request the same way.
 */

/** A `YYYY-MM` move-in month as "November 2026". */
export const monthName = (month) => {
  const date = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/** "2-bed Apartment in Dubai", "Studio in Sharjah" or "Office in Dubai" (any bedrooms). */
export function requestTitle(t, request) {
  const where = t(`marketplaceJoin.emirate.${request.emirate}`);
  const type = request.propertyType;
  if (request.bedrooms === 0) return t('marketplaceBoard.title.studio', { where });
  if (!Number.isInteger(request.bedrooms)) return t('marketplaceBoard.title.type', { type, where });
  return t('marketplaceBoard.title.beds', { count: request.bedrooms, type, where });
}

/**
 * An offered property's short title from the shared facts its card already shows (never the
 * listing's own title, which the offer replaces): "2-bed Apartment in Dubai Marina".
 */
export function offerTitle(t, listing) {
  const where = listing.community || listing.emirate;
  const type = listing.propertyType;
  const beds = Number.parseInt(listing.bedrooms, 10);
  if (!where || !type) return t('marketplaceAnswers.offeredProperty');
  if (beds === 0) return t('marketplaceBoard.title.studio', { where });
  if (!Number.isInteger(beds)) return t('marketplaceBoard.title.type', { type, where });
  return t('marketplaceBoard.title.beds', { count: beds, type, where });
}

/** Buying or renting and the budget band: "Renting · AED 150k to 250k a year". */
export function requestLine(t, request) {
  const parts = [t(`marketplaceRequests.board.purpose.${request.purpose}`)];
  if (request.budgetBand) parts.push(t(`marketplaceRequests.band.${request.budgetBand}`));
  return parts.join(' · ');
}

/** The preferences a request states, as short tags; an "any" choice adds none. */
export function requestTags(t, request) {
  const tags = [];
  const stated = (value) => Boolean(value) && value !== 'any';
  if (stated(request.ready)) tags.push(t(`marketplaceBoard.fact.${request.ready}`));
  if (stated(request.furnishing)) tags.push(t(`marketplaceBoard.fact.${request.furnishing}`));
  if (stated(request.buildingAge)) tags.push(t(`marketplaceBoard.fact.age.${request.buildingAge}`));
  if (request.cheques)
    tags.push(
      request.cheques === 1
        ? t('marketplaceBoard.fact.cheque')
        : t('marketplaceBoard.fact.cheques', { count: request.cheques }),
    );
  if (request.moveIn)
    tags.push(t('marketplaceBoard.fact.moveIn', { month: monthName(request.moveIn) }));
  if (request.openToOtherAreas) tags.push(t('marketplaceBoard.fact.otherAreas'));
  return tags;
}
