/** Read only the published aggregate statistics; never carry agreement or client identifiers. */
export function readMarketplaceStats(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const count = (number) => Number.isSafeInteger(number) && number >= 0;
  const metric = (number) => number === null || (Number.isFinite(number) && number >= 0);
  if (
    !count(value.acceptedAgreements) ||
    !count(value.completedDeals) ||
    !metric(value.completionRate) ||
    value.completionRate > 100 ||
    !metric(value.averageResponseHours) ||
    (value.responseSamples !== undefined && !count(value.responseSamples))
  )
    return null;
  return {
    acceptedAgreements: value.acceptedAgreements,
    completedDeals: value.completedDeals,
    completionRate: value.completionRate,
    averageResponseHours: value.averageResponseHours,
    responseSamples: value.responseSamples ?? null,
    disputesLost: null,
  };
}
