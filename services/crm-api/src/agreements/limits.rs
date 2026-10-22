//! The referral limit (design §14–§15, owner 2026-10-22): a referral never keeps more than
//! the sending company's `maxReferralShareBp` from Finance settings, read through the
//! finance module. While that limit is 0% no referral can be offered. It is checked when
//! terms are written and again at send, not at acceptance: the recipient agrees to the
//! exact share either way.
use super::model::{Kind, INVALID};
use crate::{
    error::{ApiError, ApiResult},
    finance::deals::handover_rows,
};
use serde_json::Value;
use sqlx::{Postgres, Transaction};

pub const NO_LIMIT: &str =
    "Your Admin has not set a referral limit yet. Ask them to set one in Finance settings.";
pub const OVER_LIMIT: &str = "The referral share is above the sending company's limit.";
/// What the receiving company sees: it neither names their Admin nor tells the two apart.
pub const OTHER_LIMIT: &str = "This referral share is above what the sending company allows.";

/// The sending company's referral limit in basis points (0 when not set).
pub async fn referral_cap(tx: &mut Transaction<'_, Postgres>, sender: &str) -> ApiResult<i64> {
    Ok(i64::from(handover_rows::cap(tx, sender).await?))
}

/// Refuses a referral share above `cap`; other kinds have no limit.
pub fn check(kind: Kind, share: i64, cap: i64) -> ApiResult<()> {
    match kind {
        Kind::Referral if cap <= 0 => Err(ApiError::invalid(NO_LIMIT)),
        Kind::Referral if share > cap => Err(ApiError::invalid(OVER_LIMIT)),
        _ => Ok(()),
    }
}

/// The stored or built `terms` of a `kind` agreement sent by `sender`, within its limit.
/// `own` is false when the receiving company writes the terms (a counter-offer).
pub async fn ensure(
    tx: &mut Transaction<'_, Postgres>,
    kind: Kind,
    terms: &Value,
    (sender, own): (&str, bool),
) -> ApiResult<()> {
    if kind != Kind::Referral {
        return Ok(());
    }
    let share = terms["money"]["senderShareBp"]
        .as_i64()
        .ok_or(ApiError::invalid(INVALID))?;
    let checked = check(kind, share, referral_cap(tx, sender).await?);
    checked.map_err(|refusal| {
        if own {
            refusal
        } else {
            ApiError::invalid(OTHER_LIMIT)
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn referrals_stay_within_the_company_limit() {
        assert_eq!(check(Kind::Referral, 100, 0).unwrap_err().1, NO_LIMIT);
        assert_eq!(
            check(Kind::Referral, 2_001, 2_000).unwrap_err().1,
            OVER_LIMIT
        );
        assert!(check(Kind::Referral, 2_000, 2_000).is_ok());
        assert!(check(Kind::CoBroking, 6_000, 0).is_ok());
        assert!(check(Kind::Full, 0, 0).is_ok());
    }
}
