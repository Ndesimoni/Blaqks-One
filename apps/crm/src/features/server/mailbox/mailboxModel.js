/** The values Google handed back in the address fragment, read once. */
export function returnedValues(hash) {
  const query = hash.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  return { state: params.get('state'), code: params.get('code'), error: params.get('error') };
}
