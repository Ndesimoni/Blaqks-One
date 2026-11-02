const AED = (n, digits = 0) =>
  new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(Number(n) || 0);

const N = (n) => new Intl.NumberFormat('en-AE').format(Number(n) || 0);

/**
 * A phone with its middle hidden, as the approved mockup's private box shows an owner's number:
 * "+971 55 *** 2210", "050 *** 4567". Short or unreadable numbers show only "***".
 */
const maskPhone = (value) => {
  const raw = String(value ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return digits ? '***' : '';
  const plus = raw.startsWith('+') ? '+' : '';
  const head =
    plus && digits.startsWith('971') ? `+971 ${digits.slice(3, 5)}` : plus + digits.slice(0, 3);
  return `${head} *** ${digits.slice(-4)}`;
};

export { AED, N, maskPhone };
