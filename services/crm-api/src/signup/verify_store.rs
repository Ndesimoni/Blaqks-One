use super::{
    code, identity, limits,
    model::{Created, Pending},
    verify_error::invalid,
};
use crate::{
    auth::{
        account::events::{self, Action},
        accounts::{self, NewAdmin},
        consents, sessions,
    },
    error::ApiResult,
    workspaces::{self, company::AccountType},
};
use sqlx::{Postgres, Transaction};

async fn attempt(
    transaction: &mut Transaction<'_, Postgres>,
    ticket_hash: &str,
) -> ApiResult<Option<Pending>> {
    sqlx::query_as(
        "UPDATE crm_signup_requests SET code_attempts=code_attempts+1, \
         total_attempts=total_attempts+1 WHERE ticket_hash=$1 AND expires_at>now() \
         AND code_expires_at>now() AND consumed_at IS NULL AND code_attempts<5 \
         AND total_attempts<10 RETURNING email,existing_account,name,phone, \
         password_hash,language,terms_version,privacy_version,consented_at::text,code_hash, \
         code_attempts,total_attempts",
    )
    .bind(ticket_hash)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(Into::into)
}

pub async fn verify(
    mut transaction: Transaction<'_, Postgres>,
    ticket: &str,
    supplied_code: &str,
    device: Option<&str>,
) -> ApiResult<Created> {
    let ticket_hash = crate::auth::session::digest(ticket);
    let email: Option<String> = sqlx::query_scalar(
        "SELECT email FROM crm_signup_requests WHERE ticket_hash=$1 \
         AND expires_at>now() AND consumed_at IS NULL",
    )
    .bind(&ticket_hash)
    .fetch_optional(&mut *transaction)
    .await?;
    let Some(email) = email else {
        let _ = code::matches(ticket, supplied_code, &code::digest(ticket, "000000"));
        transaction.rollback().await?;
        return Err(invalid(false));
    };
    let lock_key = crate::auth::session::digest(&format!("email:{email}"));
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(lock_key)
        .execute(&mut *transaction)
        .await?;
    let Some(pending) = attempt(&mut transaction, &ticket_hash).await? else {
        let locked: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM crm_signup_requests WHERE ticket_hash=$1 \
             AND expires_at>now() AND consumed_at IS NULL \
             AND (code_attempts>=5 OR total_attempts>=10))",
        )
        .bind(ticket_hash)
        .fetch_one(&mut *transaction)
        .await?;
        let _ = code::matches(ticket, supplied_code, &code::digest(ticket, "000000"));
        transaction.rollback().await?;
        return Err(invalid(locked));
    };
    let matches = code::matches(ticket, supplied_code, &pending.code_hash);
    if !matches || pending.existing_account {
        let locked = pending.code_attempts >= 5 || pending.total_attempts >= 10;
        transaction.commit().await?;
        return Err(invalid(locked));
    }
    if !identity::prepare(&mut transaction, &pending.email).await? {
        return Err(identity::consume_conflict(transaction, &pending.email).await?);
    }
    limits::company(&mut transaction).await?;
    let account_type = AccountType::Brokerage;
    let user = accounts::create_signup_admin(
        &mut transaction,
        NewAdmin {
            name: &pending.name,
            email: &pending.email,
            phone: &pending.phone,
            password_hash: &pending.password_hash,
            language: &pending.language,
            email_verified: true,
        },
    )
    .await?;
    let Some(user) = user else {
        return Err(identity::consume_conflict(transaction, &pending.email).await?);
    };
    let workspace = user.to_string();
    workspaces::create(
        &mut transaction,
        &workspace,
        user,
        user,
        workspaces::company::NewCompany {
            account_type,
            origin: workspaces::company::Origin::Signup,
        },
    )
    .await?;
    consents::record_at(
        &mut transaction,
        user,
        &pending.terms_version,
        &pending.privacy_version,
        Some(&pending.consented_at),
    )
    .await?;
    events::append(&mut transaction, user, user, &workspace, Action::SignedUp).await?;
    sqlx::query("DELETE FROM crm_signup_requests WHERE email=$1")
        .bind(&pending.email)
        .execute(&mut *transaction)
        .await?;
    let issued = sessions::issue(&mut transaction, user, device).await?;
    let profile = accounts::live_profile(&mut transaction, user).await?;
    let company = workspaces::company::get(&mut *transaction, &workspace).await?;
    transaction.commit().await?;
    Ok(Created {
        user: profile,
        company,
        session: issued,
    })
}
