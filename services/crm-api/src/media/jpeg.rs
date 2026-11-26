//! JPEG metadata removal (packet F1, security review M1). Before the image data only the
//! segments a decoder needs are kept (an allowlist); the image data is copied up to its end
//! marker and nothing after it, so a second picture or video appended by a phone (Motion
//! Photo, MPF), with its own EXIF and GPS, never reaches storage.
const BAD: &str = "invalid_image";

/// Markers kept before the scan: JFIF, Adobe, quantisation and Huffman tables, frame
/// headers, restart interval and arithmetic tables. APP2 is kept only as an ICC profile.
fn keep(marker: u8, data: &[u8]) -> bool {
    match marker {
        0xE0 | 0xEE | 0xDB | 0xC4 | 0xDD | 0xCC => true,
        0xC0..=0xCF => marker != 0xC8,
        0xE2 => data.starts_with(b"ICC_PROFILE\0"),
        _ => false,
    }
}

pub fn clean(bytes: &[u8]) -> Result<Vec<u8>, &'static str> {
    let mut out = vec![0xFF, 0xD8];
    let mut at = 2;
    loop {
        let marker = *bytes
            .get(at + 1)
            .filter(|_| bytes.get(at) == Some(&0xFF))
            .ok_or(BAD)?;
        if marker == 0xDA {
            return scan(bytes, at, out);
        }
        let length = usize::from(u16::from_be_bytes([
            *bytes.get(at + 2).ok_or(BAD)?,
            *bytes.get(at + 3).ok_or(BAD)?,
        ]));
        let end = at + 2 + length;
        if length < 2 || end > bytes.len() {
            return Err(BAD);
        }
        if keep(marker, &bytes[at + 4..end]) {
            out.extend_from_slice(&bytes[at..end]);
        }
        at = end;
    }
}

/// The image data from the first scan up to and including the first end-of-image marker.
/// Byte stuffing keeps `FF D9` out of entropy-coded data, so the first one is the end.
fn scan(bytes: &[u8], start: usize, mut out: Vec<u8>) -> Result<Vec<u8>, &'static str> {
    let end = bytes[start..]
        .windows(2)
        .position(|pair| pair == [0xFF, 0xD9])
        .map(|offset| start + offset + 2)
        .ok_or(BAD)?;
    out.extend_from_slice(&bytes[start..end]);
    Ok(out)
}
