//! Request row lock shared by marketplace offer and conversation commands.
use super::{requests, sources, visibility};
use crate::{
    error::{ApiError, ApiResult},
    records::market_requirements,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn request(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<requests::Row> {
    sqlx::query("SELECT id FROM marketplace.crm_market_requests WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(ApiError::missing)?;
    let row = requests::load(tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    if requests::state(&row) != "open" || visibility::visible(tx, row.member_id).await?.is_none() {
        return Err(ApiError::missing());
    }
    let client = sources::client_of(tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    let held =
        market_requirements::still_held(tx, &[(row.workspace_id.clone(), client, row.member_id)])
            .await?;
    if !held.contains(&client) {
        return Err(ApiError::missing());
    }
    Ok(row)
}

pub async fn active_count(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<i64> {
    sqlx::query("SELECT id FROM marketplace.crm_market_requests WHERE id=$1 FOR UPDATE")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    let answers:Vec<(Uuid,Uuid)>=sqlx::query_as("SELECT id,share_id FROM marketplace.crm_market_answers WHERE request_id=$1 AND state IN ('waiting','chosen') ORDER BY id")
        .bind(id).fetch_all(&mut **tx).await?;
    for (answer, share) in answers {
        if !crate::agreements::listings::marketplace::lapse(tx, share).await? {
            sqlx::query("UPDATE marketplace.crm_market_answers SET state='ended',decided_at=now() WHERE id=$1")
                .bind(answer).execute(&mut **tx).await?;
        }
    }
    Ok(sqlx::query_scalar("SELECT count(*) FROM marketplace.crm_market_answers WHERE request_id=$1 AND state IN ('waiting','chosen')")
        .bind(id).fetch_one(&mut **tx).await?)
}
