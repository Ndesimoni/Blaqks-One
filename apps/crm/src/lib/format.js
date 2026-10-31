const AED = (n, digits = 0) =>
  new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(Number(n) || 0);

const N = (n) => new Intl.NumberFormat('en-AE').format(Number(n) || 0);

export { AED, N };
