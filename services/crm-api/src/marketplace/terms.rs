//! Versioned marketplace terms (review amendment 4): each row is bound to its text by a SHA-256
//! digest, rows are inserted only by migrations, and the current row is the newest
//! `published_at` up to now (never a sort of the version text). Acceptances store the digest.
use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::{types::Json, Postgres, Transaction};

pub const OUTDATED: &str = "Review the current marketplace terms, then accept them.";
pub const ALREADY: &str = "You have already accepted these terms.";
pub const DRAFT: &str = "The marketplace terms are still a draft for legal review.";
pub const BROKEN: &str = "The marketplace terms could not be verified. Contact Blaqks One.";

/// A draft version may be used in development and tests, never on a hosted server (§14.4).
pub fn refuse_draft(terms: &Terms, hosted: bool) -> ApiResult<()> {
    if terms.draft && hosted {
        return Err(ApiError::conflict(DRAFT));
    }
    Ok(())
}

#[derive(Clone, Debug, Deserialize, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Terms {
    pub version: String,
    pub body: String,
    pub consent: String,
    pub commitments: Json<Vec<String>>,
    pub digest: String,
    pub draft: bool,
}

const COLUMNS: &str = "version,body,consent,commitments,digest,draft";

/// A stored row whose text no longer matches its digest is never offered or accepted
/// (MK1 code review L6): the digest is recomputed from the row each time it is read.
fn verified(found: Option<Terms>) -> ApiResult<Option<Terms>> {
    match found {
        Some(terms)
            if digest(
                &terms.body,
                &terms.consent,
                &terms.commitments.0,
                &terms.version,
            ) != terms.digest =>
        {
            Err(ApiError(
                StatusCode::SERVICE_UNAVAILABLE,
                BROKEN,
                "terms_broken",
            ))
        }
        other => Ok(other),
    }
}

/// The newest published terms, if any.
pub async fn current(tx: &mut Transaction<'_, Postgres>) -> ApiResult<Option<Terms>> {
    verified(
        sqlx::query_as(&format!(
            "SELECT {COLUMNS} FROM marketplace.crm_market_terms \
         WHERE published_at<=now() ORDER BY published_at DESC LIMIT 1"
        ))
        .fetch_optional(&mut **tx)
        .await?,
    )
}

pub async fn by_version(
    tx: &mut Transaction<'_, Postgres>,
    version: &str,
) -> ApiResult<Option<Terms>> {
    verified(
        sqlx::query_as(&format!(
            "SELECT {COLUMNS} FROM marketplace.crm_market_terms \
             WHERE version=$1 AND published_at<=now()"
        ))
        .bind(version)
        .fetch_optional(&mut **tx)
        .await?,
    )
}

/// SHA-256 over compact JSON with sorted keys: `{"body","commitments","consent","version"}`.
/// Anyone holding the row can recompute it; a changed word changes the digest.
pub fn digest(body: &str, consent: &str, commitments: &[String], version: &str) -> String {
    let value = json!({
        "body": body,
        "commitments": commitments,
        "consent": consent,
        "version": version,
    });
    Sha256::digest(value.to_string().as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// What the caller sent back must be exactly the current text.
pub fn current_or_outdated(
    tx_terms: Option<Terms>,
    version: &str,
    digest: &str,
) -> ApiResult<Terms> {
    match tx_terms {
        Some(terms) if terms.version == version && terms.digest == digest => Ok(terms),
        _ => Err(ApiError::conflict(OUTDATED)),
    }
}

pub use super::acceptances::{accept, accepted, consent};

#[cfg(test)]
#[path = "terms_tests.rs"]
mod tests;
