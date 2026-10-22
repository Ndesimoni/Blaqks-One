//! Terms of an in-company hand-over (design §14 A3a), built by the server from the deal so
//! the sender never types them. The §6 allowlist applies: the client's first name and last
//! initial, a few property facts (none when the deal has no property), no record IDs and no
//! contact. Inside a company the referral is a share of the receiving agent's commission
//! line, so the money basis is `agent_commission` and the deal's fee is context only.
use super::{
    limits,
    model::{Kind, INVALID},
    terms::{digest_of, BuiltTerms},
};
use crate::{
    error::{ApiError, ApiResult},
    records::handover_facts::PropertyFacts,
};
use serde_json::{json, Value};
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};

const EXPIRY_DAYS: i64 = 14;

/// What finance and records know about the deal being handed over.
#[derive(Clone, Debug, Default)]
pub struct HandoverFacts {
    pub referral_bp: Option<i32>,
    pub fee_fils: i64,
    pub client_name: Option<String>,
    pub property: Option<PropertyFacts>,
}

/// "Layla Hassan" → "Layla H."; one word stays as it is unless it looks like an email or
/// a number; nothing → "Client".
pub fn display_name(full: Option<&str>) -> String {
    let mut words = full.unwrap_or("").split_whitespace();
    match (words.next(), words.last()) {
        (Some(first), Some(last)) => format!("{} {}.", clip(first, 60), initial(last)),
        (Some(only), None) if !only.chars().any(|c| c == '@' || c.is_ascii_digit()) => {
            clip(only, 40)
        }
        _ => "Client".into(),
    }
}

fn initial(word: &str) -> String {
    word.chars()
        .next()
        .map(|c| c.to_uppercase().collect())
        .unwrap_or_default()
}

fn clip(text: &str, max: usize) -> String {
    text.trim().chars().take(max).collect()
}

fn text(value: &Option<String>, max: usize) -> Value {
    match value.as_deref().map(str::trim) {
        Some(text) if !text.is_empty() => json!(clip(text, max)),
        _ => Value::Null,
    }
}

fn whole(value: &Option<String>) -> Value {
    let parsed = value
        .as_deref()
        .and_then(|raw| raw.trim().parse::<i64>().ok());
    parsed
        .filter(|n| (0..=1_000_000).contains(n))
        .map_or(Value::Null, Value::from)
}

/// "2450000" or "2,450,000.50" AED → fils; anything else is left out.
pub fn fils(value: &Option<String>) -> Value {
    let raw = value.as_deref().unwrap_or("").trim().replace(',', "");
    let (whole, part) = raw.split_once('.').unwrap_or((raw.as_str(), ""));
    let cents = format!("{part:0<2}");
    let ok = !whole.is_empty() && cents.len() == 2;
    let digits = |s: &str| s.chars().all(|c| c.is_ascii_digit());
    if !ok || !digits(whole) || !digits(&cents) {
        return Value::Null;
    }
    let amount = whole
        .parse::<i64>()
        .ok()
        .and_then(|aed| aed.checked_mul(100));
    let total = amount.zip(cents.parse::<i64>().ok()).map(|(a, c)| a + c);
    total
        .filter(|f| (1..=1_000_000_000_000).contains(f))
        .map_or(Value::Null, Value::from)
}

fn property(facts: &PropertyFacts) -> Value {
    json!({
        "emirate": text(&facts.emirate, 40),
        "area": text(&facts.community, 80),
        "propertyType": text(&facts.property_type, 40),
        "bedrooms": whole(&facts.bedrooms),
        "sizeSqft": whole(&facts.size_sqft),
        "askingPriceFils": fils(&facts.price_aed),
        "listingRef": null,
    })
}

/// The kind and sealed-ready terms; a referral must fit the team's limit `cap`.
pub fn build(
    facts: &HandoverFacts,
    cap: i64,
    now: OffsetDateTime,
) -> ApiResult<(Kind, BuiltTerms)> {
    let share = i64::from(facts.referral_bp.unwrap_or(0));
    let kind = if share > 0 {
        Kind::Referral
    } else {
        Kind::Full
    };
    let (sender_bp, recipient_bp) = kind.shares(share)?;
    limits::check(kind, sender_bp, cap)?;
    if !(0..=1_000_000_000_000).contains(&facts.fee_fils) {
        return Err(ApiError::invalid(INVALID));
    }
    let property = facts.property.as_ref().map_or(Value::Null, property);
    let emirate = property["emirate"].as_str().unwrap_or("Dubai").to_owned();
    let expires_at = now + Duration::days(EXPIRY_DAYS);
    let stamp = expires_at
        .format(&Rfc3339)
        .map_err(|_| ApiError::invalid(INVALID))?;
    let value = json!({
        "kind": kind.as_str(),
        "subject": {
            "property": property,
            "client": { "displayName": display_name(facts.client_name.as_deref()), "contact": null },
        },
        "money": {
            "basis": "agent_commission",
            "amountFils": facts.fee_fils,
            "senderShareBp": sender_bp,
            "recipientShareBp": recipient_bp,
            "paymentExpectation": "on_receipt",
        },
        "expiresAt": stamp,
        "governingEmirate": emirate,
        "notes": null,
    });
    let subject_digest = digest_of(&value["subject"]);
    Ok((
        kind,
        BuiltTerms {
            value,
            subject_digest,
            expires_at,
        },
    ))
}
