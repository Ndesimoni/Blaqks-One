//! Lead rules (plan §2.3, design §6), evaluated only for unknown senders. A source marked
//! as ad, listing, lead form or portal creates the lead; at least two property words
//! (English or Arabic) suggest it, or create it when the Admin chose `create`.
use crate::{error::ApiResult, integrations::webhooks::message::Source};
use sqlx::{FromRow, Postgres, Transaction};
use std::collections::BTreeSet;

pub const DEFAULT_WORDS_EN: [&str; 18] = [
    "apartment",
    "villa",
    "townhouse",
    "penthouse",
    "studio",
    "bedroom",
    "bedrooms",
    "rent",
    "buy",
    "sale",
    "price",
    "viewing",
    "off-plan",
    "offplan",
    "property",
    "unit",
    "budget",
    "mortgage",
];
pub const DEFAULT_WORDS_AR: [&str; 14] = [
    "شقة",
    "فيلا",
    "تاون هاوس",
    "استوديو",
    "غرفة",
    "غرف",
    "إيجار",
    "ايجار",
    "شراء",
    "بيع",
    "سعر",
    "معاينة",
    "عقار",
    "ميزانية",
];
pub const SOURCES: [&str; 4] = ["ad", "listing", "form", "portal"];
const ARABIC_PREFIXES: [&str; 10] = ["وال", "بال", "فال", "كال", "لل", "ال", "و", "ب", "ل", "ف"];

#[derive(Clone, Debug, FromRow, PartialEq)]
pub struct Rules {
    /// `suggest` (default) or `create` for messages that match property words.
    pub lead_mode: String,
    pub auto_sources: Vec<String>,
    pub words_en: Vec<String>,
    pub words_ar: Vec<String>,
    /// 0 until an Admin first saves the rules.
    pub version: i64,
}

impl Rules {
    pub fn defaults() -> Self {
        let owned = |words: &[&str]| words.iter().map(|word| (*word).to_owned()).collect();
        Self {
            lead_mode: "suggest".into(),
            auto_sources: owned(&SOURCES),
            words_en: owned(&DEFAULT_WORDS_EN),
            words_ar: owned(&DEFAULT_WORDS_AR),
            version: 0,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Decision {
    Create,
    Suggest,
    Nothing,
}

/// Distinct configured words found in `text`. Single words match whole tokens;
/// phrases (such as `تاون هاوس`) match as written.
pub fn words_found(rules: &Rules, text: &str) -> usize {
    let lowered = text.to_lowercase();
    let mut tokens: BTreeSet<&str> = BTreeSet::new();
    for token in lowered.split(|c: char| !(c.is_alphanumeric() || c == '-')) {
        if token.is_empty() {
            continue;
        }
        tokens.insert(token);
        // Arabic joins the article and short prepositions to the word: للإيجار, السعر.
        for prefix in ARABIC_PREFIXES {
            if let Some(stem) = token
                .strip_prefix(prefix)
                .filter(|stem| stem.chars().count() >= 2)
            {
                tokens.insert(stem);
            }
        }
    }
    let found: BTreeSet<String> = rules
        .words_en
        .iter()
        .chain(rules.words_ar.iter())
        .map(|word| word.to_lowercase())
        .filter(|word| {
            if word.contains(' ') {
                lowered.contains(word.as_str())
            } else {
                tokens.contains(word.as_str())
            }
        })
        .collect();
    found.len()
}

/// What happens to an unknown sender's first message.
pub fn decide(rules: &Rules, source: Option<Source>, text: &str) -> Decision {
    if source.is_some_and(|source| rules.auto_sources.iter().any(|s| s == source.as_str())) {
        return Decision::Create;
    }
    if words_found(rules, text) >= 2 {
        return if rules.lead_mode == "create" {
            Decision::Create
        } else {
            Decision::Suggest
        };
    }
    Decision::Nothing
}

/// The company's saved rules, or the defaults.
pub async fn load(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<Rules> {
    let saved: Option<Rules> = sqlx::query_as(
        "SELECT lead_mode,auto_sources,words_en,words_ar,version FROM inbox.crm_inbox_rules \
         WHERE workspace_id=$1",
    )
    .bind(workspace)
    .fetch_optional(&mut **transaction)
    .await?;
    Ok(saved.unwrap_or_else(Rules::defaults))
}

#[cfg(test)]
#[path = "rules_tests.rs"]
mod tests;
