//! WebP metadata removal (packet F1): drops the `EXIF` and `XMP ` chunks, clears their
//! flags in `VP8X`, and rewrites the RIFF size. A malformed file is refused.
const BAD: &str = "invalid_image";

pub fn clean(bytes: &[u8]) -> Result<Vec<u8>, &'static str> {
    if bytes.len() < 12 {
        return Err(BAD);
    }
    let declared = u32::from_le_bytes(bytes[4..8].try_into().map_err(|_| BAD)?) as usize;
    if declared + 8 > bytes.len() {
        return Err(BAD);
    }
    let mut out = b"RIFF\0\0\0\0WEBP".to_vec();
    let mut at = 12;
    while at + 8 <= declared + 8 {
        let size = u32::from_le_bytes(bytes[at + 4..at + 8].try_into().map_err(|_| BAD)?) as usize;
        let padded = size + (size & 1);
        let end = at.checked_add(8 + padded).ok_or(BAD)?;
        if end > bytes.len() {
            return Err(BAD);
        }
        let mut chunk = bytes[at..end].to_vec();
        match &chunk[..4] {
            b"EXIF" | b"XMP " => {}
            b"VP8X" => {
                // Bit 3 says EXIF follows, bit 2 says XMP follows; neither does any more.
                if let Some(flags) = chunk.get_mut(8) {
                    *flags &= !0b0000_1100;
                }
                out.extend_from_slice(&chunk);
            }
            _ => out.append(&mut chunk),
        }
        at = end;
    }
    let size = u32::try_from(out.len() - 8).map_err(|_| BAD)?;
    out[4..8].copy_from_slice(&size.to_le_bytes());
    Ok(out)
}
