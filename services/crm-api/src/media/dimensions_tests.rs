//! Image header sizes for the three stored image types.
use super::of;

fn png(width: u32, height: u32) -> Vec<u8> {
    let mut bytes = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
    bytes.extend(width.to_be_bytes());
    bytes.extend(height.to_be_bytes());
    bytes.extend([8, 6, 0, 0, 0]);
    bytes
}

#[test]
fn png_jpeg_and_webp_headers_give_their_size() {
    assert_eq!(of(&png(3000, 10), "image/png"), Some((3000, 10)));
    // SOI, an APP0 segment of 4 bytes, then SOF0: length, precision, height 480, width 640.
    let jpeg = [
        0xFF, 0xD8, 0xFF, 0xE0, 0, 4, 0, 0, 0xFF, 0xC0, 0, 17, 8, 0x01, 0xE0, 0x02, 0x80,
    ];
    assert_eq!(of(&jpeg, "image/jpeg"), Some((640, 480)));
    let mut vp8x = b"RIFF\0\0\0\0WEBPVP8X\x0a\0\0\0\0\0\0\0".to_vec();
    vp8x.extend([0x1F, 0x03, 0x00, 0xDF, 0x01, 0x00]);
    assert_eq!(of(&vp8x, "image/webp"), Some((800, 480)));
    let mut lossy = b"RIFF\0\0\0\0WEBPVP8 \0\0\0\0\0\0\0\x9d\x01\x2a".to_vec();
    lossy.extend([0x20, 0x03, 0xE0, 0x01]);
    assert_eq!(of(&lossy, "image/webp"), Some((800, 480)));
}

#[test]
fn unknown_or_cut_short_headers_give_nothing() {
    assert_eq!(of(b"%PDF-1.4", "application/pdf"), None);
    assert_eq!(of(&png(1, 1)[..18], "image/png"), None);
    assert_eq!(of(&[0xFF, 0xD8, 0xFF, 0xE0, 0, 4], "image/jpeg"), None);
    assert_eq!(of(b"RIFF\0\0\0\0WEBPABCD", "image/webp"), None);
}
