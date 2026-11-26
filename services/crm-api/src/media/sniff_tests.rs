use super::*;

fn segment(marker: u8, data: &[u8]) -> Vec<u8> {
    let mut out = vec![0xFF, marker];
    out.extend_from_slice(&((data.len() + 2) as u16).to_be_bytes());
    out.extend_from_slice(data);
    out
}

fn png_chunk(kind: &[u8; 4], data: &[u8]) -> Vec<u8> {
    let mut out = (data.len() as u32).to_be_bytes().to_vec();
    out.extend_from_slice(kind);
    out.extend_from_slice(data);
    out.extend_from_slice(&[0, 0, 0, 0]);
    out
}

fn webp_chunk(kind: &[u8; 4], data: &[u8]) -> Vec<u8> {
    let mut out = kind.to_vec();
    out.extend_from_slice(&(data.len() as u32).to_le_bytes());
    out.extend_from_slice(data);
    if data.len() % 2 == 1 {
        out.push(0);
    }
    out
}

#[test]
fn the_real_type_comes_from_the_bytes() {
    assert_eq!(detect(&[0xFF, 0xD8, 0xFF, 0xE0]), Some(Kind::Jpeg));
    assert_eq!(detect(b"%PDF-1.7\n"), Some(Kind::Pdf));
    assert_eq!(detect(b"<svg xmlns=\"http://www.w3.org/2000/svg\">"), None);
    assert_eq!(detect(b"<html><script>"), None);
    assert_eq!(detect(b""), None);
}

#[test]
fn jpeg_loses_exif_and_iptc_but_keeps_the_image() {
    let mut file = vec![0xFF, 0xD8];
    file.extend(segment(0xE0, b"JFIF\0"));
    file.extend(segment(0xE1, b"Exif\0\0GPS-25.08,55.14"));
    file.extend(segment(0xED, b"Photoshop 3.0 IPTC"));
    file.extend(segment(0xE2, b"ICC_PROFILE\0"));
    file.extend([0xFF, 0xDA, 0x00, 0x02, 0x11, 0x22, 0xFF, 0xD9]);
    let cleaned = clean(Kind::Jpeg, &file).unwrap();
    let text = String::from_utf8_lossy(&cleaned);
    assert!(!text.contains("GPS") && !text.contains("IPTC"));
    assert!(text.contains("JFIF") && text.contains("ICC_PROFILE"));
    assert!(cleaned.ends_with(&[0x11, 0x22, 0xFF, 0xD9]));
    assert!(clean(Kind::Jpeg, &[0xFF, 0xD8, 0xFF, 0xE1, 0xFF, 0xFF]).is_err());
}

#[test]
fn png_loses_text_chunks_and_needs_its_end() {
    let mut file = b"\x89PNG\r\n\x1a\n".to_vec();
    file.extend(png_chunk(b"IHDR", &[0; 13]));
    file.extend(png_chunk(b"tEXt", b"Comment\0client home"));
    file.extend(png_chunk(b"eXIf", b"GPS"));
    file.extend(png_chunk(b"IDAT", b"pixels"));
    let without_end = file.clone();
    file.extend(png_chunk(b"IEND", b""));
    let cleaned = clean(Kind::Png, &file).unwrap();
    let text = String::from_utf8_lossy(&cleaned);
    assert!(!text.contains("client home") && !text.contains("GPS"));
    assert!(text.contains("IDAT") && text.contains("IEND"));
    assert!(clean(Kind::Png, &without_end).is_err());
}

#[test]
fn webp_loses_exif_and_xmp_and_its_flags() {
    let mut body = b"WEBP".to_vec();
    body.extend(webp_chunk(
        b"VP8X",
        &[0b0000_1100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ));
    body.extend(webp_chunk(b"VP8 ", b"frame"));
    body.extend(webp_chunk(b"EXIF", b"GPS here"));
    body.extend(webp_chunk(b"XMP ", b"<x:xmpmeta/>"));
    let mut file = b"RIFF".to_vec();
    file.extend(((body.len()) as u32).to_le_bytes());
    file.extend(body);
    let cleaned = clean(Kind::Webp, &file).unwrap();
    let text = String::from_utf8_lossy(&cleaned);
    assert!(!text.contains("GPS") && !text.contains("xmpmeta"));
    assert_eq!(cleaned[20], 0, "VP8X no longer announces EXIF or XMP");
    let size = u32::from_le_bytes(cleaned[4..8].try_into().unwrap()) as usize;
    assert_eq!(size + 8, cleaned.len());
    assert!(clean(Kind::Webp, &file[..20]).is_err());
}

#[test]
fn appended_pictures_and_unknown_segments_never_survive() {
    let image = |extra: &[u8]| {
        let mut file = vec![0xFF, 0xD8];
        file.extend(segment(0xE0, b"JFIF\0"));
        file.extend(segment(0xFE, b"comment with an address"));
        file.extend(segment(0xE2, b"MPF\0secondary image index"));
        file.extend(segment(0xE2, b"ICC_PROFILE\0colours"));
        file.extend(segment(0xEB, b"unknown app segment"));
        file.extend([0xFF, 0xDA, 0x00, 0x02, 0x11, 0xFF, 0x00, 0x22, 0xFF, 0xD9]);
        file.extend(extra);
        file
    };
    // A phone's motion photo: a second JPEG with EXIF GPS after the first image ends.
    let mut appended = vec![0xFF, 0xD8];
    appended.extend(segment(0xE1, b"Exif\0\0GPS 25.08N 55.14E"));
    appended.extend([0xFF, 0xDA, 0x00, 0x02, 0x33, 0xFF, 0xD9]);
    let cleaned = clean(Kind::Jpeg, &image(&appended)).unwrap();
    let text = String::from_utf8_lossy(&cleaned);
    assert!(!text.contains("Exif") && !text.contains("GPS"));
    assert!(!text.contains("comment") && !text.contains("MPF") && !text.contains("unknown"));
    assert!(text.contains("ICC_PROFILE") && text.contains("JFIF"));
    assert!(cleaned.ends_with(&[0x11, 0xFF, 0x00, 0x22, 0xFF, 0xD9]));
    let mut endless = image(&[]);
    endless.truncate(endless.len() - 2);
    assert!(
        clean(Kind::Jpeg, &endless).is_err(),
        "no end marker, no image"
    );
}

#[test]
fn png_keeps_only_known_safe_extra_chunks() {
    let mut file = b"\x89PNG\r\n\x1a\n".to_vec();
    file.extend(png_chunk(b"IHDR", &[0; 13]));
    file.extend(png_chunk(b"gAMA", &[0, 0, 177, 143]));
    file.extend(png_chunk(b"caBX", b"private camera data"));
    file.extend(png_chunk(b"IDAT", b"pixels"));
    file.extend(png_chunk(b"IEND", b""));
    let cleaned = clean(Kind::Png, &file).unwrap();
    let text = String::from_utf8_lossy(&cleaned);
    assert!(text.contains("gAMA") && !text.contains("caBX"));
}
