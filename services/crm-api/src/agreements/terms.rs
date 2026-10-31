//! Frozen revision terms (docs/agreements-design.md §3, §6): an allowlist of
//! property and client facts, money in fils, shares in basis points and a bounded
//! expiry. `evidence.rs` binds these terms to the agreement and parties and digests them.
use super::{
    model::{Kind, INVALID},
    wire,
};
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use time::{format_description::well_known::Rfc3339, Duration, OffsetDateTime};

const TERM_KEYS: [&str; 6] = [
    "property",
    "client",
    "money",
    "expiresAt",
    "governingEmirate",
    "notes",
];
const PROPERTY_KEYS: [&str; 7] = [
    "emirate",
    "area",
    "propertyType",
    "bedrooms",
    "sizeSqft",
    "askingPriceFils",
    "listingRef",
];
const CLIENT_KEYS: [&str; 2] = ["displayName", "contact"];
const DEFAULT_DAYS: i64 = 14;
const MAX_DAYS: i64 = 90;

pub struct BuiltTerms {
    pub value: Value,
    pub subject_digest: String,
    pub expires_at: OffsetDateTime,
}

pub fn hex(bytes: impl AsRef<[u8]>) -> String {
    bytes
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub fn build(kind: Kind, input: &Value, now: OffsetDateTime) -> ApiResult<BuiltTerms> {
    build_with(kind, input, None, now)
}

/// As `build`, with `frozen` (a listing share's property) in place of the input's.
pub fn build_with(
    kind: Kind,
    input: &Value,
    frozen: Option<&Value>,
    now: OffsetDateTime,
) -> ApiResult<BuiltTerms> {
    let terms = wire::exact(input.clone(), &TERM_KEYS, INVALID)?;
    let property = match frozen {
        Some(property) => property.clone(),
        None => property(wire::node(&terms, "property")?)?,
    };
    let client = wire::exact(wire::node(&terms, "client")?.clone(), &CLIENT_KEYS, INVALID)?;
    let money = super::term_money::build(kind, wire::node(&terms, "money")?)?;
    let client = json!({
        "displayName": wire::text(wire::node(&client, "displayName")?, 80)?,
        "contact": wire::optional_text(wire::node(&client, "contact")?, 120)?,
    });
    let expires_at = expiry(wire::node(&terms, "expiresAt")?, now)?;
    let value = json!({
        "kind": kind.as_str(),
        "subject": { "property": property, "client": client },
        "money": money,
        "expiresAt": stamp(expires_at)?,
        "governingEmirate": wire::text(wire::node(&terms, "governingEmirate")?, 40)?,
        "notes": wire::optional_text(wire::node(&terms, "notes")?, 2_000)?,
    });
    Ok(BuiltTerms {
        subject_digest: digest_of(&value["subject"]),
        value,
        expires_at,
    })
}

fn property(input: &Value) -> ApiResult<Value> {
    let property = wire::exact(input.clone(), &PROPERTY_KEYS, INVALID)?;
    Ok(json!({
        "emirate": wire::text(wire::node(&property, "emirate")?, 40)?,
        "area": wire::text(wire::node(&property, "area")?, 80)?,
        "propertyType": wire::text(wire::node(&property, "propertyType")?, 40)?,
        "bedrooms": wire::count(wire::node(&property, "bedrooms")?, 20)?,
        "sizeSqft": wire::count(wire::node(&property, "sizeSqft")?, 1_000_000)?,
        "askingPriceFils": wire::amount(wire::node(&property, "askingPriceFils")?)?,
        "listingRef": wire::text(wire::node(&property, "listingRef")?, 40)?,
    }))
}

fn expiry(value: &Value, now: OffsetDateTime) -> ApiResult<OffsetDateTime> {
    let earliest = now + Duration::hours(1);
    let latest = now + Duration::days(MAX_DAYS);
    match value {
        Value::Null => Ok(now + Duration::days(DEFAULT_DAYS)),
        Value::String(raw) => {
            let at =
                OffsetDateTime::parse(raw, &Rfc3339).map_err(|_| ApiError::invalid(INVALID))?;
            if at <= earliest || at > latest {
                return Err(ApiError::invalid(INVALID));
            }
            Ok(at)
        }
        _ => Err(ApiError::invalid(INVALID)),
    }
}

fn stamp(value: OffsetDateTime) -> ApiResult<String> {
    value
        .format(&Rfc3339)
        .map_err(|_| ApiError::invalid(INVALID))
}

/// SHA-256 over compact JSON. `serde_json` maps are sorted by key (no
/// `preserve_order`), so the same value always serialises to the same bytes.
pub fn digest_of(value: &Value) -> String {
    hex(Sha256::digest(value.to_string().as_bytes()))
}
