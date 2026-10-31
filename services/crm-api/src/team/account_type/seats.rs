use crate::{
    error::{ApiError, ApiResult},
    workspaces::company,
};
use axum::http::StatusCode;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

pub fn limit_error() -> ApiError {
    ApiError(
        StatusCode::CONFLICT,
        "This company has reached its team limit.",
        "team_limit_reached",
    )
}

/// Checks one candidate seat. The owner always occupies one seat; active staff and
/// invitations that can currently be activated occupy the remaining seats.
pub async fn available(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    candidate: Option<Uuid>,
) -> ApiResult<bool> {
    let Some(limit) = company::seat_limit(transaction, workspace).await? else {
        return Ok(true);
    };
    let occupied = occupied(transaction, workspace, candidate).await?;
    Ok(occupied < i64::from(limit))
}

pub async fn occupied(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    candidate: Option<Uuid>,
) -> ApiResult<i64> {
    sqlx::query_scalar(
        "SELECT 1+count(*) FROM crm_users u WHERE u.role='staff' AND u.workspace_id=$1 \
         AND u.deleted_at IS NULL AND u.id IS DISTINCT FROM $2 AND ( \
         (u.active AND u.accepted_at IS NOT NULL) OR (u.accepted_at IS NULL AND EXISTS( \
         SELECT 1 FROM crm_team_invitations i WHERE i.user_id=u.id AND i.workspace_id=$1 \
         AND i.expires_at>now() AND i.consumed_at IS NULL AND i.revoked_at IS NULL)))",
    )
    .bind(workspace)
    .bind(candidate)
    .fetch_one(&mut **transaction)
    .await
    .map_err(Into::into)
}

pub async fn usage(pool: &PgPool, workspace: &str) -> ApiResult<(i64, Option<i32>, i64)> {
    let company = company::get(pool, workspace).await?;
    let used = sqlx::query_scalar(
        "SELECT 1+count(u.id) FILTER (WHERE u.role='staff' AND u.deleted_at IS NULL AND ( \
         (u.active AND u.accepted_at IS NOT NULL) OR (u.accepted_at IS NULL AND EXISTS( \
         SELECT 1 FROM crm_team_invitations i WHERE i.user_id=u.id AND i.workspace_id=$1 \
         AND i.expires_at>now() AND i.consumed_at IS NULL AND i.revoked_at IS NULL)))) \
         FROM crm_users u WHERE u.workspace_id=$1",
    )
    .bind(workspace)
    .fetch_one(pool)
    .await?;
    Ok((used, company.member_limit, company.version))
}

pub async fn ensure(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    candidate: Option<Uuid>,
) -> ApiResult<()> {
    if !available(transaction, workspace, candidate).await? {
        return Err(limit_error());
    }
    Ok(())
}
