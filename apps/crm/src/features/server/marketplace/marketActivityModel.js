/** UI capabilities complement server checks; no other broker's inventory is inferred. */
export function requestActivityCapabilities(detail) {
  const request = detail?.request || {};
  const active = Number.isInteger(request.activeOffers) ? request.activeOffers : 3;
  const isPoster = request.isPoster === true;
  const open = request.state === 'open';
  return {
    active,
    isPoster,
    open,
    canOffer:
      !isPoster &&
      open &&
      active < 3 &&
      request.canOffer === true &&
      !(detail?.answers || []).some((answer) => ['waiting', 'chosen'].includes(answer.state)),
    canMessage:
      !isPoster &&
      open &&
      active < 3 &&
      (detail?.matches || []).length === 0 &&
      request.canMessage === true,
  };
}
