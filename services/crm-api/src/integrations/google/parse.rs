//! Turning a Gmail message into what the Inbox stores (E1c): the sender, plain text only
//! (HTML is reduced to text here, so no markup, script, form or remote image ever reaches
//! the browser), whether it carried attachments, and whether it is a bounce.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Deserialize;

pub const MAX_TEXT: usize = 20_000;

#[derive(Deserialize, Default)]
pub struct Part {
    #[serde(rename = "mimeType", default)]
    pub mime: String,
    #[serde(default)]
    pub headers: Vec<Header>,
    pub body: Option<Body>,
    #[serde(default)]
    pub parts: Vec<Part>,
    #[serde(default)]
    pub filename: String,
}

#[derive(Deserialize)]
pub struct Header {
    pub name: String,
    pub value: String,
}

#[derive(Deserialize)]
pub struct Body {
    pub data: Option<String>,
    #[serde(rename = "attachmentId")]
    pub attachment: Option<String>,
}

pub fn header<'a>(headers: &'a [Header], name: &str) -> Option<&'a str> {
    headers
        .iter()
        .find(|header| header.name.eq_ignore_ascii_case(name))
        .map(|header| header.value.trim())
}

/// `Name <a@b>` or `a@b` → (name, lower-case address).
pub fn sender(from: &str) -> (Option<String>, String) {
    match (from.rfind('<'), from.rfind('>')) {
        (Some(open), Some(close)) if open < close => {
            let name = from[..open].trim().trim_matches('"').trim();
            let name = (!name.is_empty()).then(|| name.chars().take(120).collect());
            (name, from[open + 1..close].trim().to_ascii_lowercase())
        }
        _ => (None, from.trim().to_ascii_lowercase()),
    }
}

/// A delivery status report (not a read receipt), by its content type (review E1c M3).
pub fn is_report(content_type: Option<&str>) -> bool {
    content_type.is_some_and(|value| {
        let value = value.to_ascii_lowercase();
        value.contains("multipart/report") && value.contains("report-type=delivery-status")
    })
}

/// The report says delivery failed for good (a `Status: 5.x.x` line).
pub fn permanent_failure(payload: &Part) -> bool {
    find(payload, "message/delivery-status")
        .and_then(decoded)
        .is_some_and(|status| {
            status
                .lines()
                .any(|line| line.trim().to_ascii_lowercase().starts_with("status: 5."))
        })
}

fn decoded(part: &Part) -> Option<String> {
    let data = part.body.as_ref()?.data.as_deref()?;
    let bytes = URL_SAFE_NO_PAD.decode(data.trim_end_matches('=')).ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

fn find<'a>(part: &'a Part, mime: &str) -> Option<&'a Part> {
    if part.mime.eq_ignore_ascii_case(mime) && part.filename.is_empty() {
        return Some(part);
    }
    part.parts.iter().find_map(|child| find(child, mime))
}

fn has_attachment(part: &Part) -> bool {
    !part.filename.is_empty()
        || part
            .body
            .as_ref()
            .is_some_and(|body| body.attachment.is_some())
        || part.parts.iter().any(has_attachment)
}

/// The message as plain text (plain part first, else the HTML part reduced to text),
/// bounded, and whether any attachment came with it.
pub fn text(payload: &Part) -> (String, bool) {
    let text = find(payload, "text/plain")
        .and_then(decoded)
        .or_else(|| {
            find(payload, "text/html")
                .and_then(decoded)
                .map(|html| super::html::to_text(&html))
        })
        .unwrap_or_default();
    let clean: String = text
        .replace("\r\n", "\n")
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .take(MAX_TEXT)
        .collect();
    (clean.trim().to_owned(), has_attachment(payload))
}

#[cfg(test)]
#[path = "parse_tests.rs"]
mod tests;
