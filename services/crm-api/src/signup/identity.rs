use crate::{
    auth::accounts::{self, EmailState},
    error::{ApiError, ApiResult},
    team::invitations::signup::{self, State},
};
use axum::http::StatusCode;
use sqlx::{PgPool, Postgres, Transaction};

pub struct Classification {
    pub existing: bool,
    pub notice: Option<&'static str>,
}

pub async fn classify(pool: &PgPool, email: &str) -> ApiResult<Classification> {
    let state = accounts::email_state(pool, email).await?;
    let invitation = match state {
        EmailState::Invitation(user) => user,
        _ => uuid::Uuid::nil(),
    };
    let invitation_state = signup::state(pool, invitation).await?;
    let result = match state {
        EmailState::Available => Classification {
            existing: false,
            notice: None,
        },
        EmailState::Invitation(_) => match invitation_state {
            State::Releasable => Classification {
                existing: false,
                notice: None,
            },
            State::Live => Classification {
                existing: true,
                notice: Some("invitation_pending"),
            },
            State::Unavailable => Classification {
                existing: true,
                notice: Some("email_unavailable"),
            },
        },
        EmailState::Existing => Classification {
            existing: true,
            notice: Some("existing_account"),
        },
        EmailState::Unavailable => Classification {
            existing: true,
            notice: Some("email_unavailable"),
        },
    };
    Ok(result)
}

/// Re-checks every identity state under the caller's per-email lock. Only the narrow
/// mailbox-verified abandoned-invitation path may release an existing email.
pub async fn prepare(transaction: &mut Transaction<'_, Postgres>, email: &str) -> ApiResult<bool> {
    match accounts::email_state(&mut **transaction, email).await? {
        EmailState::Available => Ok(true),
        EmailState::Invitation(user) => signup::release(transaction, user, email).await,
        EmailState::Existing | EmailState::Unavailable => Ok(false),
    }
}

pub async fn consume_conflict(
    mut transaction: Transaction<'_, Postgres>,
    email: &str,
) -> ApiResult<ApiError> {
    sqlx::query("DELETE FROM crm_signup_requests WHERE email=$1")
        .bind(email)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(ApiError(
        StatusCode::CONFLICT,
        "This email cannot create a new account. Sign in or start again.",
        "account_exists",
    ))
}
