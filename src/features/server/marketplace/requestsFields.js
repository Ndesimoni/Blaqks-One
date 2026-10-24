/**
 * The strict readers' building blocks (packet MK2): a value the server sends must be the shape
 * described here, or the whole answer is refused rather than half-shown.
 */
export const invalid = () => new Error('The server returned invalid client request information.');
export const isObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const text = (value, max = 120) => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) throw invalid();
  return value.trim();
};

export const id = (value) => {
  const read = text(value, 200);
  if (!read) throw invalid();
  return read;
};

export const oneOf = (value, allowed) => {
  if (!allowed.includes(value)) throw invalid();
  return value;
};

/** A value the server may leave empty. */
export const maybeOneOf = (value, allowed) =>
  value === null || value === undefined ? '' : oneOf(value, allowed);

export const whole = (value) => {
  if (!Number.isInteger(value) || value < 0) throw invalid();
  return value;
};

export const maybeWhole = (value) => (value === null || value === undefined ? null : whole(value));

export const money = (value) => {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
};

export const stamp = (value) => {
  const read = text(value, 40);
  if (!read || Number.isNaN(Date.parse(read))) throw invalid();
  return read;
};

export const names = (value) => {
  if (!Array.isArray(value) || value.length > 12) throw invalid();
  return value.map((name) => {
    const read = text(name, 60);
    if (!read) throw invalid();
    return read;
  });
};
