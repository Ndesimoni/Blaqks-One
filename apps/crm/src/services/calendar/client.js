export async function calendarRequest(path, { method = 'GET', body, csrf, signal } = {}) {
  const response = await fetch(`/api/calendar/${path}`, {
    method,
    credentials: 'same-origin',
    signal,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(csrf ? { 'X-Calendar-CSRF': csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw Error(
      result?.message ||
        'The calendar connection is unavailable. Your CRM schedule is still saved.',
    );
  return result;
}
