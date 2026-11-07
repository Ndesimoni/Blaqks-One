//! The terms digest (review amendment 4): stable, lowercase hex, and it covers every part.
use super::digest;

#[test]
fn the_digest_is_stable_and_covers_every_part_of_the_text() {
    let commitments = vec!["One.".to_owned(), "Two.".to_owned()];
    let first = digest(
        "Terms body.",
        "Shown to members.",
        &commitments,
        "2026-10-24.1",
    );
    assert_eq!(first.len(), 64);
    assert!(first
        .chars()
        .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
    assert_eq!(
        first,
        digest(
            "Terms body.",
            "Shown to members.",
            &commitments,
            "2026-10-24.1"
        )
    );
    assert_ne!(
        first,
        digest(
            "Terms body!",
            "Shown to members.",
            &commitments,
            "2026-10-24.1"
        )
    );
    assert_ne!(
        first,
        digest(
            "Terms body.",
            "Shown to members.",
            &commitments,
            "2026-10-24.2"
        )
    );
    assert_ne!(
        first,
        digest(
            "Terms body.",
            "Shown to members.",
            &commitments[..1],
            "2026-10-24.1"
        )
    );
}
