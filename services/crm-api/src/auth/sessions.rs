//! Session storage. Auth owns `crm_sessions`: sign-in and password change issue sessions
//! here, and team suspensions and archives sign members out through these functions
//! (service-boundaries C5), inside the caller's transaction.
use super::session;
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// A newly issued session: the cookie token and its anti-forgery token. Only the token's
/// digest is stored.
pub struct Issued {
    pub token: String,
    pub csrf_token: String,
}

/// Stores a fresh 8-hour session for `user` with new random session and CSRF tokens.
pub async fn issue(
    transaction: &mut Transaction<'_, Postgres>,
    user: Uuid,
    device: Option<&str>,
) -> ApiResult<Issued> {
    let issued = Issued {
        token: session::random_token(),
        csrf_token: session::random_token(),
    };
    sqlx::query(
        "INSERT INTO crm_sessions (token_hash,user_id,csrf_token,expires_at,device) \
         VALUES ($1,$2,$3,now()+interval '8 hours',$4)",
    )
    .bind(session::digest(&issued.token))
    .bind(user)
    .bind(&issued.csrf_token)
    .bind(device)
    .execute(&mut **transaction)
    .await?;
    Ok(issued)
}

/// Signs out `member` and every account they own (an Admin's staff).
pub async fn revoke_member(
    transaction: &mut Transaction<'_, Postgres>,
    member: Uuid,
) -> ApiResult<()> {
    sqlx::query(
        "DELETE FROM crm_sessions WHERE user_id=$1 \
         OR user_id IN (SELECT id FROM crm_users WHERE owner_id=$1)",
    )
    .bind(member)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

/// Signs out every listed account.
pub async fn revoke_all(
    transaction: &mut Transaction<'_, Postgres>,
    members: &[Uuid],
) -> ApiResult<()> {
    sqlx::query("DELETE FROM crm_sessions WHERE user_id=ANY($1)")
        .bind(members)
        .execute(&mut **transaction)
        .await?;
    Ok(())
}
