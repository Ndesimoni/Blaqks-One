use super::{events, validation, Company, NewCompany};
use crate::error::{ApiError, ApiResult};
use axum::http::StatusCode;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn get<'e>(executor: impl sqlx::PgExecutor<'e>, workspace: &str) -> ApiResult<Company> {
    sqlx::query_as::<_, Company>(
        "SELECT account_type,member_limit,display_name,emirate, \
         setup_completed_at IS NOT NULL AS setup_complete,version \
         FROM crm_company_profiles WHERE workspace_id=$1",
    )
    .bind(workspace)
    .fetch_optional(executor)
    .await?
    .ok_or_else(ApiError::forbidden)
}

/// Called with workspace creation inside the same transaction. The type derives seats.
pub async fn create(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    company: NewCompany,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO crm_company_profiles (workspace_id,account_type,member_limit,origin) \
         VALUES ($1,$2,$3,$4)",
    )
    .bind(workspace)
    .bind(company.account_type.name())
    .bind(if workspace == crate::workspaces::ORGANISATION {
        None
    } else {
        company.account_type.member_limit()
    })
    .bind(company.origin.name())
    .execute(&mut **transaction)
    .await?;
    events::append(
        transaction,
        workspace,
        actor,
        "created",
        None,
        Some(company.account_type.name()),
    )
    .await
}

pub(super) async fn update_details(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    request: &validation::UpdateRequest,
) -> ApiResult<Company> {
    let current = get(&mut **transaction, workspace).await?;
    if current.version != request.version {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Your company changed elsewhere. Reload and try again.",
            "stale",
        ));
    }
    validation::for_company(request)?;
    sqlx::query(
        "UPDATE crm_company_profiles SET display_name=$2,emirate=$3, \
         setup_completed_at=COALESCE(setup_completed_at,now()),updated_at=now(), \
         version=version+1 WHERE workspace_id=$1",
    )
    .bind(workspace)
    .bind(&request.display_name)
    .bind(&request.emirate)
    .execute(&mut **transaction)
    .await?;
    events::append(transaction, workspace, actor, "details_updated", None, None).await?;
    get(&mut **transaction, workspace).await
}

pub async fn seat_limit(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<Option<i32>> {
    sqlx::query_scalar("SELECT member_limit FROM crm_company_profiles WHERE workspace_id=$1")
        .bind(workspace)
        .fetch_optional(&mut **transaction)
        .await?
        .ok_or_else(ApiError::forbidden)
}

pub async fn set_member_limit(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    from: i32,
    to: i32,
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE crm_company_profiles SET member_limit=$2,updated_at=now(),version=version+1 \
         WHERE workspace_id=$1",
    )
    .bind(workspace)
    .bind(to)
    .execute(&mut **transaction)
    .await?;
    sqlx::query(
        "INSERT INTO crm_company_limit_events(workspace_id,actor_id,from_limit,to_limit) \
         VALUES($1,$2,$3,$4)",
    )
    .bind(workspace)
    .bind(actor)
    .bind(from)
    .bind(to)
    .execute(&mut **transaction)
    .await?;
    Ok(())
}
