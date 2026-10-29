use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    workspaces,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn member(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<UserRow> {
    let live = workspaces::ensure_writable(tx, workspace, actor, None, None).await?;
    if live.workspace_id != workspace || !["admin", "staff"].contains(&live.role.as_str()) {
        return Err(ApiError::forbidden());
    }
    Ok(live)
}
pub async fn owner(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
) -> ApiResult<UserRow> {
    let live = member(tx, workspace, actor).await?;
    if live.role != "admin" || workspaces::owner_of(tx, workspace).await? != actor {
        return Err(ApiError::forbidden());
    }
    Ok(live)
}
pub async fn operator(tx: &mut Transaction<'_, Postgres>, actor: Uuid) -> ApiResult<()> {
    let live = workspaces::member(tx, workspaces::ORGANISATION, actor).await?;
    if live.role != "super-admin" {
        return Err(ApiError::forbidden());
    }
    Ok(())
}
pub async fn live_profile_member(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
) -> ApiResult<Option<UserRow>> {
    match workspaces::member(tx, workspace, member).await {
        Ok(live)
            if live.workspace_id == workspace
                && live.can_collection("Properties")
                && ["admin", "staff"].contains(&live.role.as_str()) =>
        {
            Ok(Some(live))
        }
        Ok(_) => Ok(None),
        Err(error) if error.0 == axum::http::StatusCode::FORBIDDEN => Ok(None),
        Err(error) => Err(error),
    }
}

pub async fn live_company(tx: &mut Transaction<'_, Postgres>, workspace: &str) -> ApiResult<bool> {
    let owner = match workspaces::owner_of(tx, workspace).await {
        Ok(id) => id,
        Err(e) if e.0 == axum::http::StatusCode::FORBIDDEN => return Ok(false),
        Err(e) => return Err(e),
    };
    match workspaces::member(tx, workspace, owner).await {
        Ok(live) => Ok(live.workspace_id == workspace && live.role == "admin"),
        Err(e) if e.0 == axum::http::StatusCode::FORBIDDEN => Ok(false),
        Err(e) => Err(e),
    }
}
