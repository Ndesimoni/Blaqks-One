//! What the sender reviews before a listing leaves the company (review amendment 5, the
//! exported-content policy as built): structured fields come from the allowlist; free text,
//! links and photos are sent as the listing has them, so the review flags free text that
//! looks like a phone or email, any links, and photos that cannot be sent, and the sender
//! confirms. Copies get neutral names ("Photo 1"); image uploads already had their metadata
//! removed. PDFs keep document properties the sender never sees, so they stay behind (R2a
//! security review M3).
use super::snapshot::File;
use crate::{media::copies::Source, records::outside_facts::Asset};
use serde_json::{Map, Value};
use std::collections::HashMap;
use uuid::Uuid;

const LINKS: [&str; 4] = ["listingUrl", "virtualTourUrl", "floorPlanUrl", "mapLink"];
const FREE_TEXT: [&str; 5] = [
    "listingTitle",
    "building",
    "amenities",
    "description",
    "keySellingPoints",
];

/// Phone numbers (nine or more digits) or email addresses in free text.
pub fn looks_like_contact(text: &str) -> bool {
    let email = text.split_whitespace().any(|word| {
        word.split_once('@')
            .is_some_and(|(user, host)| !user.is_empty() && host.contains('.'))
    });
    let phone = text
        .split(|c: char| !(c.is_ascii_digit() || " +-().".contains(c)))
        .any(|run| run.chars().filter(char::is_ascii_digit).count() >= 9);
    email || phone
}

pub fn files(
    kind: &'static str,
    assets: &[Asset],
    found: &HashMap<Uuid, Source>,
) -> (Vec<File>, usize, usize) {
    let mut kept = Vec::new();
    let mut pdfs = 0;
    let label = if kind == "photo" {
        "Photo"
    } else {
        "Floor plan"
    };
    for asset in assets {
        let Some(source) = found.get(&asset.file) else {
            continue;
        };
        if source.content_type == "application/pdf" {
            pdfs += 1;
            continue;
        }
        let thumb = asset.thumb.and_then(|thumb| found.get(&thumb)).cloned();
        let name = format!("{label} {}", kept.len() + 1);
        kept.push(File {
            kind,
            name,
            source: source.clone(),
            thumb,
        });
    }
    let missing = assets.len() - kept.len() - pdfs;
    (kept, missing, pdfs)
}

/// The warning codes the review shows (the screen words them).
/// `counts` are the older inline files, those over the limits, those not found and PDFs.
pub fn warnings(
    facts: &Map<String, Value>,
    counts: (usize, usize, usize, usize),
) -> Vec<&'static str> {
    let (inline, over, missing, pdfs) = counts;
    let mut warnings = Vec::new();
    let mut free = FREE_TEXT.iter().filter_map(|key| facts.get(*key)?.as_str());
    if free.any(looks_like_contact) {
        warnings.push("contact");
    }
    if LINKS.iter().any(|key| facts.contains_key(*key)) {
        warnings.push("links");
    }
    if inline > 0 {
        warnings.push("inline");
    }
    if over > 0 {
        warnings.push("over");
    }
    if missing > 0 {
        warnings.push("unavailable");
    }
    if pdfs > 0 {
        warnings.push("pdf");
    }
    warnings
}
