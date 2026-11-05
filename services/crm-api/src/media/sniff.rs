//! What a file really is, from its first bytes, and its photo metadata removed (packet
//! F1). Phone photos carry EXIF with the GPS location of a client's home; it never reaches
//! storage. Only JPEG, PNG, WebP and PDF are accepted; SVG, HTML and anything else are
//! refused whatever the browser claims. A malformed image is refused, never stored.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Kind {
    Jpeg,
    Png,
    Webp,
    Pdf,
}

impl Kind {
    pub fn content_type(self) -> &'static str {
        match self {
            Self::Jpeg => "image/jpeg",
            Self::Png => "image/png",
            Self::Webp => "image/webp",
            Self::Pdf => "application/pdf",
        }
    }

    pub fn max_bytes(self) -> usize {
        match self {
            Self::Pdf => 20 * 1024 * 1024,
            _ => 10 * 1024 * 1024,
        }
    }
}

pub fn detect(bytes: &[u8]) -> Option<Kind> {
    match bytes {
        [0xFF, 0xD8, 0xFF, ..] => Some(Kind::Jpeg),
        [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, ..] => Some(Kind::Png),
        [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..] => Some(Kind::Webp),
        [b'%', b'P', b'D', b'F', b'-', ..] => Some(Kind::Pdf),
        _ => None,
    }
}

const BAD: &str = "invalid_image";

/// The file without metadata; PDFs are kept as uploaded.
pub fn clean(kind: Kind, bytes: &[u8]) -> Result<Vec<u8>, &'static str> {
    match kind {
        Kind::Jpeg => super::jpeg::clean(bytes),
        Kind::Png => png(bytes),
        Kind::Webp => super::webp::clean(bytes),
        Kind::Pdf => Ok(bytes.to_vec()),
    }
}

/// Copies critical chunks and only known-safe ancillary ones (colour, gamma, transparency,
/// density); text, EXIF, time and unknown chunks are dropped. Requires IEND.
fn png(bytes: &[u8]) -> Result<Vec<u8>, &'static str> {
    let mut out = bytes[..8].to_vec();
    let mut at = 8;
    while at + 12 <= bytes.len() {
        let length = u32::from_be_bytes(bytes[at..at + 4].try_into().map_err(|_| BAD)?) as usize;
        let end = at.checked_add(12 + length).ok_or(BAD)?;
        if end > bytes.len() {
            return Err(BAD);
        }
        let kind = &bytes[at + 4..at + 8];
        let critical = kind[0].is_ascii_uppercase();
        let safe = matches!(
            kind,
            b"gAMA" | b"cHRM" | b"sRGB" | b"iCCP" | b"pHYs" | b"sBIT" | b"bKGD" | b"tRNS"
        );
        if critical || safe {
            out.extend_from_slice(&bytes[at..end]);
        }
        if kind == b"IEND" {
            return Ok(out);
        }
        at = end;
    }
    Err(BAD)
}

#[cfg(test)]
#[path = "sniff_tests.rs"]
mod tests;
