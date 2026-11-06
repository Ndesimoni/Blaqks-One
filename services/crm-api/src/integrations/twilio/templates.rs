//! A Twilio content template as the CRM keeps it (design §3 and §8). Only `twilio/text`
//! templates whose placeholders are `{{1}}` to `{{k}}` (at most ten) can be offered; any
//! other type or variable form is kept as `other` for the Admin's list. Approval is one
//! fixed word. Names, languages and categories are bounded before they are stored.
use serde::Deserialize;
use serde_json::Value;

pub use super::placeholders::{fill, variable_count};

const MAX_BODY: usize = 1024;

#[derive(Deserialize)]
pub struct Content {
    #[serde(default)]
    pub sid: String,
    #[serde(default)]
    pub friendly_name: String,
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub types: Value,
    #[serde(default)]
    pub approval_requests: Value,
}

#[derive(Debug, PartialEq)]
pub struct Parsed {
    pub sid: String,
    pub name: String,
    pub language: String,
    pub category: Option<String>,
    pub approval: &'static str,
    /// `Some((body, variables))` for an offerable text template.
    pub text: Option<(String, i16)>,
}

/// The template, or `None` when its ID is not a content SID.
pub fn parse(content: &Content) -> Option<Parsed> {
    let sid = content.sid.as_str();
    let hex = sid.strip_prefix("HX").is_some_and(|rest| {
        rest.len() == 32
            && rest
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    });
    if !hex {
        return None;
    }
    let name: String = content
        .friendly_name
        .chars()
        .filter(|c| !c.is_control())
        .collect();
    let name: String = name.trim().chars().take(200).collect();
    // ContentAndApprovals lists the WhatsApp request itself; one content read nests it.
    let request = match content.approval_requests.get("whatsapp") {
        Some(nested) => nested,
        None => &content.approval_requests,
    };
    let category = request["category"]
        .as_str()
        .filter(|word| (1..=40).contains(&word.len()))
        .filter(|word| word.bytes().all(|b| b.is_ascii_uppercase() || b == b'_'));
    let text = content.types["twilio/text"]["body"]
        .as_str()
        .filter(|body| (1..=MAX_BODY).contains(&body.chars().count()))
        .and_then(|body| variable_count(body).map(|count| (body.to_owned(), count)));
    Some(Parsed {
        sid: sid.to_owned(),
        name: if name.is_empty() {
            "Untitled template".into()
        } else {
            name
        },
        language: language(&content.language),
        category: category.map(str::to_owned),
        approval: approval(request["status"].as_str().unwrap_or("")),
        text,
    })
}

fn language(value: &str) -> String {
    let (head, tail) = value.split_once(['_', '-']).unwrap_or((value, ""));
    let head_ok = (2..=3).contains(&head.len()) && head.bytes().all(|b| b.is_ascii_alphabetic());
    let tail_ok = tail.is_empty()
        || ((2..=8).contains(&tail.len()) && tail.bytes().all(|b| b.is_ascii_alphanumeric()));
    if head_ok && tail_ok {
        value.to_owned()
    } else {
        "und".into()
    }
}

fn approval(status: &str) -> &'static str {
    match status {
        "approved" => "approved",
        "rejected" => "rejected",
        "paused" => "paused",
        "disabled" => "disabled",
        "pending" | "received" | "unsubmitted" | "in_review" => "pending",
        _ => "other",
    }
}

#[cfg(test)]
#[path = "templates_tests.rs"]
mod tests;
