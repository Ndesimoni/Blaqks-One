/** Synthetic files and raw uploads for the media suites (packet F1). */
import { api, origin } from './helpers.mjs';

const segment = (marker, data) => {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(data.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), length, data]);
};

/** A tiny JPEG whose EXIF block carries a fake GPS location. */
export const jpegWithGps = () =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0')),
    segment(0xe1, Buffer.from('Exif\0\0GPS 25.0800N 55.1400E')),
    Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]),
  ]);

/** A phone "motion photo": a second JPEG with EXIF GPS appended after the first ends. */
export const motionPhoto = () =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0')),
    Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]),
    Buffer.from([0xff, 0xd8]),
    segment(0xe1, Buffer.from('Exif\0\0GPS 25.0800N 55.1400E')),
    Buffer.from([0xff, 0xda, 0x00, 0x02, 0x33, 0xff, 0xd9]),
  ]);

export const pdf = () => Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');

/** Sends raw bytes as the session, with the display name in `X-File-Name`. */
export async function upload(session, bytes, name = 'photo.jpg', { csrf = true } = {}) {
  const response = await fetch(`${api}/workspaces/${session.user.workspaceId}/media`, {
    method: 'POST',
    headers: {
      Origin: origin,
      Cookie: session.cookie,
      ...(csrf ? { 'X-CSRF-Token': session.csrf } : {}),
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(name),
    },
    body: bytes,
  });
  return { status: response.status, value: await response.json().catch(() => null) };
}

/** Downloads a chat attachment as the session. */
export async function download(session, room, message, file) {
  const path = `/workspaces/${session.user.workspaceId}/chat/rooms/${room}/messages/${message}/files/${file}`;
  const response = await fetch(`${api}${path}`, { headers: { Cookie: session.cookie } });
  return {
    status: response.status,
    headers: response.headers,
    bytes: Buffer.from(await response.arrayBuffer()),
  };
}
