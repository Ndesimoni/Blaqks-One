//! Versioned legal evidence belongs to auth and commits with account creation.
//! Draft identifiers must be replaced with lawyer-approved document versions before
//! hosting; packet S1 publishes neither legal documents nor a sign-up route.
use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const TERMS_VERSION: &str = "draft-2026-10-16";
pub const PRIVACY_VERSION: &str = "draft-2026-10-16";

/// Missing evidence is a 400; changed documents require the person to review again.
pub fn validate(terms: &str, privacy: &str) -> ApiResult<()> {
    if terms.trim().is_empty() || privacy.trim().is_empty() {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Accept the Terms of Service and read the Privacy Notice.",
            "consent_required",
        ));
    }
    if terms != TERMS_VERSION || privacy != PRIVACY_VERSION {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Review the current Terms of Service and Privacy Notice.",
            "consent_outdated",
        ));
    }
    Ok(())
}

/// The database records server time and rejects UPDATE, DELETE and TRUNCATE. This
/// single insert writes both documents, so partial evidence cannot be committed.
pub async fn record(
    transaction: &mut Transaction<'_, Postgres>,
    user: Uuid,
    terms: &str,
    privacy: &str,
) -> ApiResult<()> {
    record_at(transaction, user, terms, privacy, None).await
}

pub async fn record_at(
    transaction: &mut Transaction<'_, Postgres>,
    user: Uuid,
    terms: &str,
    privacy: &str,
    accepted_at: Option<&str>,
) -> ApiResult<()> {
    validate(terms, privacy)?;
    sqlx::query(
        "INSERT INTO crm_account_consents (user_id,document,version,accepted_at) \
         VALUES ($1,'terms',$2,COALESCE($4::timestamptz,now())), \
         ($1,'privacy',$3,COALESCE($4::timestamptz,now()))",
    )
    .bind(user)
    .bind(terms)
    .bind(privacy)
    .bind(accepted_at)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

#[cfg(test)]
#[path = "consents_tests.rs"]
mod tests;
