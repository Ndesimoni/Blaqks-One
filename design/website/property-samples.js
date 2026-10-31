export function extraPropertyData(index, type, area) {
  const purpose = ['buy', 'rent', 'holiday'][Math.floor(index / 6)];
  const commercial = type === 'Office';
  const bedrooms = commercial ? null : index % 6 === 0 ? 0 : (index % 4) + 1;
  const parking = index % 3 === 0 ? 0 : type === 'Villa' ? 2 : 1;
  const amenities =
    type === 'Villa' ? ['garden', 'pool', 'maids-room'] : commercial ? [] : ['balcony', 'gym'];
  if (parking) amenities.push('parking');
  return {
    emirate: area.emirate,
    category: commercial ? 'commercial' : 'residential',
    bedrooms,
    parking,
    amenities,
    furnishing: ['furnished', 'unfurnished', 'part-furnished'][index % 3],
    ready: purpose === 'buy' && index % 4 === 0 ? 'off-plan' : 'ready',
    market: purpose === 'buy' ? (index % 2 === 0 ? 'primary' : 'resale') : '',
    guests: purpose === 'holiday' ? Math.max(2, bedrooms * 2) : null,
    minimumStay: purpose === 'holiday' ? (index % 3) + 1 : null,
    publishedAt: new Date(Date.UTC(2026, 9, 28 - index)).toISOString(),
  };
}
