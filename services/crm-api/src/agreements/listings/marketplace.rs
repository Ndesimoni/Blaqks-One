//! Marketplace-owned actions use these Agreements owner functions inside their transaction.
use super::store;
use crate::error::{ApiError, ApiResult};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;
pub async fn live(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<bool> {
    Ok(store::locked(tx, id)
        .await?
        .is_some_and(|r| r.origin == "marketplace" && r.open() && !r.paused()))
}
pub async fn lapse(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<bool> {
    Ok(store::locked(tx, id)
        .await?
        .is_some_and(|r| r.origin == "marketplace" && r.open()))
}

pub async fn summary(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    user: &crate::auth::profile::UserRow,
) -> ApiResult<Value> {
    let row = store::find(tx, id).await?.ok_or_else(ApiError::missing)?;
    if row.origin != "marketplace" {
        return Err(ApiError::missing());
    }
    let caller = super::access::Caller {
        id: user.id,
        workspace: &user.workspace_id,
        admin: user.role == "admin",
    };
    let place = super::places::one(tx, &row, &caller).await?;
    let allowed = matches!(
        place,
        Some(super::access::Viewer::Sender | super::access::Viewer::Agent)
    );
    Ok(if allowed && row.open() && !row.paused() {
        super::market_view::basic(&row.facts)
    } else {
        Value::Null
    })
}

pub async fn end(tx: &mut Transaction<'_, Postgres>, id: Uuid, actor: Uuid) -> ApiResult<()> {
    let row = store::locked(tx, id).await?.ok_or_else(ApiError::missing)?;
    if row.origin != "marketplace" {
        return Err(ApiError::missing());
    }
    if !row.open() {
        return Ok(());
    }
    if super::market_release::standing(tx, id).await? {
        return Ok(());
    }
    let (status, action) = if row.status == "accepted" {
        ("stopped", "stopped")
    } else {
        ("declined", "declined")
    };
    sqlx::query("UPDATE agreements.crm_listing_shares SET status=$3,decided_at=CASE WHEN status='pending' THEN now() ELSE decided_at END,closed_at=now(),closed_by=$2 WHERE id=$1")
        .bind(id).bind(actor).bind(status).execute(&mut **tx).await?;
    store::event(tx, id, action, Some((actor, "recipient")), (None, None)).await
}

pub fn caller(user: &crate::auth::profile::UserRow) -> super::access::Caller<'_> {
    super::access::Caller {
        id: user.id,
        workspace: &user.workspace_id,
        admin: user.role == "admin",
    }
}
