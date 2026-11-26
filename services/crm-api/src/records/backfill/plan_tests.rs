use super::*;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::json;

fn segment(marker: u8, data: &[u8]) -> Vec<u8> {
    let mut out = vec![0xFF, marker];
    out.extend_from_slice(&((data.len() + 2) as u16).to_be_bytes());
    out.extend_from_slice(data);
    out
}

/// A tiny synthetic JPEG whose EXIF block carries a fake GPS location.
fn jpeg_with_gps() -> Vec<u8> {
    let mut file = vec![0xFF, 0xD8];
    file.extend(segment(0xE0, b"JFIF\0"));
    file.extend(segment(0xE1, b"Exif\0\0GPS 25.0800N 55.1400E"));
    file.extend([0xFF, 0xDA, 0x00, 0x02, 0x11, 0x22, 0xFF, 0xD9]);
    file
}

const PDF: &[u8] = b"%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n";

fn inline(name: &str, mime: &str, bytes: &[u8]) -> Value {
    json!({"name": name, "src": format!("data:{mime};base64,{}", STANDARD.encode(bytes)),
        "type": mime, "added": "2026-01-02"})
}

fn run(photos: Value, plans: Value, headroom: &mut i64) -> Plan {
    plan(&[(PHOTOS, Some(photos)), (PLANS, Some(plans))], headroom)
}

fn left(plan: &Plan) -> Vec<(&'static str, usize, Reason)> {
    plan.left.clone()
}

#[test]
fn inline_photos_and_pdf_plans_move_cleaned_and_typed() {
    let stored = json!({"name": "kept.jpg", "file": "11111111-1111-4111-8111-111111111111"});
    let photos = json!([stored, inline("Front", "image/jpeg", &jpeg_with_gps())]);
    let plans = json!([inline("Plan.html", "application/pdf", PDF)]);
    let mut headroom = i64::MAX;
    let plan = run(photos, plans, &mut headroom);
    assert!(plan.left.is_empty());
    let moved: Vec<_> = plan
        .moves
        .iter()
        .map(|item| (item.field, item.index))
        .collect();
    assert_eq!(
        moved,
        [(PHOTOS, 1), (PLANS, 0)],
        "the stored photo is untouched"
    );
    let photo = &plan.moves[0];
    assert_eq!(
        (photo.file.name.as_str(), photo.file.kind),
        ("Front.jpg", Kind::Jpeg)
    );
    assert_eq!(photo.added.as_deref(), Some("2026-01-02"));
    let text = String::from_utf8_lossy(&photo.file.bytes);
    assert!(
        !text.contains("Exif") && !text.contains("GPS"),
        "metadata removed"
    );
    let pdf = &plan.moves[1];
    assert_eq!(
        (pdf.file.name.as_str(), pdf.file.kind),
        ("Plan.pdf", Kind::Pdf)
    );
    assert_eq!(pdf.file.bytes, PDF, "PDFs are stored as they are");
    assert_eq!(i64::MAX - headroom, plan.bytes());
}

#[test]
fn the_real_type_decides_whatever_the_data_url_claims() {
    let mut headroom = i64::MAX;
    let photos = json!([
        inline("plan-as-photo", "image/jpeg", PDF),
        inline("animation", "image/jpeg", b"GIF89a\x01\x00\x01\x00"),
        inline("cut", "image/jpeg", &jpeg_with_gps()[..12]),
    ]);
    let plans = json!([inline("photo-plan", "application/pdf", &jpeg_with_gps())]);
    let plan = run(photos, plans, &mut headroom);
    assert_eq!(
        left(&plan),
        [
            (PHOTOS, 0, Reason::Unsupported),
            (PHOTOS, 1, Reason::Unsupported),
            (PHOTOS, 2, Reason::Unreadable),
        ]
    );
    let plan_photo = &plan.moves[0];
    assert_eq!(
        (plan_photo.field, plan_photo.file.kind),
        (PLANS, Kind::Jpeg)
    );
    assert_eq!(plan_photo.file.name, "photo-plan.jpg");
}

#[test]
fn oversized_and_over_quota_files_stay_inline() {
    let mut huge = jpeg_with_gps();
    huge.resize(10 * 1024 * 1024 + 1, 0);
    let mut headroom = i64::MAX;
    let plan = run(
        json!([inline("huge", "image/jpeg", &huge)]),
        json!([]),
        &mut headroom,
    );
    assert_eq!(left(&plan), [(PHOTOS, 0, Reason::TooLarge)]);
    assert!(plan.moves.is_empty());
    let one = jpeg_with_gps();
    let photos = json!([
        inline("a", "image/jpeg", &one),
        inline("b", "image/jpeg", &one)
    ]);
    // Each cleaned copy is 19 bytes: room for one of them only.
    let mut headroom = 30;
    let plan = run(photos, json!(null), &mut headroom);
    assert_eq!(
        plan.moves.len(),
        1,
        "the first fits the company's remaining space"
    );
    assert_eq!(left(&plan), [(PHOTOS, 1, Reason::OverQuota)]);
    assert_eq!(headroom, 30 - plan.bytes());
}

#[test]
fn records_without_inline_media_plan_nothing() {
    let mut headroom = 1;
    let plan = plan(
        &[(PHOTOS, None), (PLANS, Some(json!("not a list")))],
        &mut headroom,
    );
    assert!(plan.moves.is_empty() && plan.left.is_empty());
    assert_eq!(headroom, 1);
}
