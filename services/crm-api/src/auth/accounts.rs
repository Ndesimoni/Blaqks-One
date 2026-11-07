//! Auth-owned identity creation. Callers compose workspace creation in the same
//! transaction; this contract accepts no role, workspace, membership or access grants.
use super::{account::language, identity_rules, profile::UserRow};
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub(crate) struct NewAdmin<'a> {
    pub name: &'a str,
    pub email: &'a str,
    pub phone: &'a str,
    /// A hash produced by auth::password after the caller checks the password policy.
    pub password_hash: &'a str,
    pub language: &'a str,
    /// True only after the caller proves mailbox ownership; bootstrap passes false.
    pub email_verified: bool,
}

pub(crate) enum EmailState {
    Available,
    Invitation(Uuid),
    Existing,
    Unavailable,
}

pub(crate) async fn create_admin(
    transaction: &mut Transaction<'_, Postgres>,
    account: NewAdmin<'_>,
) -> ApiResult<Uuid> {
    let name = account.name.trim();
    let email = account.email.trim().to_lowercase();
    identity_rules::identity(name, &email, account.phone)?;
    let language = language::allowed(account.language)
        .ok_or_else(|| ApiError::invalid("Choose English or Arabic."))?;
    if account.password_hash.is_empty() {
        return Err(ApiError::invalid("A password hash is required."));
    }
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_users \
         (id,name,email,phone,password_hash,role,language,email_verified_at) \
         VALUES ($1,$2,$3,$4,$5,'admin',$6,CASE WHEN $7 THEN now() END)",
    )
    .bind(id)
    .bind(name)
    .bind(email)
    .bind(account.phone)
    .bind(account.password_hash)
    .bind(language)
    .bind(account.email_verified)
    .execute(&mut **transaction)
    .await?;
    Ok(id)
}

/// Sign-up's race-safe insert. A concurrent invitation or verification returns `None`
/// without aborting the caller's transaction, so its request can be consumed cleanly.
pub(crate) async fn create_signup_admin(
    transaction: &mut Transaction<'_, Postgres>,
    account: NewAdmin<'_>,
) -> ApiResult<Option<Uuid>> {
    let name = account.name.trim();
    let email = account.email.trim().to_lowercase();
    identity_rules::identity(name, &email, account.phone)?;
    let language = language::allowed(account.language)
        .ok_or_else(|| ApiError::invalid("Choose English or Arabic."))?;
    if account.password_hash.is_empty() || !account.email_verified {
        return Err(ApiError::invalid("A verified password hash is required."));
    }
    let id = Uuid::new_v4();
    sqlx::query_scalar(
        "INSERT INTO crm_users \
         (id,name,email,phone,password_hash,role,language,email_verified_at) \
         VALUES ($1,$2,$3,$4,$5,'admin',$6,now()) ON CONFLICT (email) DO NOTHING RETURNING id",
    )
    .bind(id)
    .bind(name)
    .bind(email)
    .bind(account.phone)
    .bind(account.password_hash)
    .bind(language)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(Into::into)
}

pub(crate) async fn email_state<'e>(
    executor: impl sqlx::PgExecutor<'e>,
    email: &str,
) -> ApiResult<EmailState> {
    let row: Option<(Uuid, bool, bool, bool, bool)> = sqlx::query_as(
        "SELECT id,active,accepted_at IS NOT NULL,deleted_at IS NOT NULL,password_hash='' \
         FROM crm_users WHERE email=$1",
    )
    .bind(email)
    .fetch_optional(executor)
    .await?;
    Ok(match row {
        None => EmailState::Available,
        Some((id, false, false, false, true)) => EmailState::Invitation(id),
        Some((_, _, _, true, _)) => EmailState::Unavailable,
        Some(_) => EmailState::Existing,
    })
}

pub(crate) async fn live_profile(
    transaction: &mut Transaction<'_, Postgres>,
    user: Uuid,
) -> ApiResult<UserRow> {
    sqlx::query_as("SELECT * FROM crm_user_profiles WHERE id=$1 AND active AND owner_active")
        .bind(user)
        .fetch_optional(&mut **transaction)
        .await?
        .ok_or_else(ApiError::unauthorized)
}

/// Tenancy calls this under its workspace lock before an owner-only write. The row
/// lock serializes with suspension/archive even when those take another workspace lock.
pub(crate) async fn lock_active_admin(
    transaction: &mut Transaction<'_, Postgres>,
    owner: Uuid,
) -> ApiResult<()> {
    sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM crm_users WHERE id=$1 AND active AND deleted_at IS NULL \
         AND role='admin' FOR SHARE",
    )
    .bind(owner)
    .fetch_optional(&mut **transaction)
    .await?
    .ok_or_else(ApiError::forbidden)?;
    Ok(())
}

#[cfg(test)]
#[path = "accounts_tests.rs"]
mod tests;
