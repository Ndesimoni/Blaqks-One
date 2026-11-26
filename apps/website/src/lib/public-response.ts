export async function readPublicBody(response: Response, limit = 2_000_000): Promise<string> {
  if (Number(response.headers.get('content-length')) > limit)
    throw Error('Oversized public response.');
  if (!response.body) throw Error('Empty public response.');
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let size = 0,
    text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw Error('Oversized public response.');
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
