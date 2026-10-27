//! Ending a request retires offer capabilities through their owning Agreements module.
use crate::{agreements::listings, error::ApiResult};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn ensure_reopen(tx: &mut Transaction<'_, Postgres>, request: Uuid) -> ApiResult<()> {
    let shares: Vec<Uuid> = sqlx::query_scalar(
        "SELECT share_id FROM marketplace.crm_market_answers WHERE request_id=$1 ORDER BY id",
    )
    .bind(request)
    .fetch_all(&mut **tx)
    .await?;
    if listings::market_release::lock_standing(tx, &shares).await? {
        return Err(crate::error::ApiError::conflict("Cancel the accepted co-broking agreement with the other broker before reopening this request."));
    }
    for share in shares {
        listings::marketplace::live(tx, share).await?;
    }
    Ok(())
}

pub async fn end_offers(
    tx: &mut Transaction<'_, Postgres>,
    request: Uuid,
    actor: Uuid,
) -> ApiResult<()> {
    let shares:Vec<Uuid>=sqlx::query_scalar("SELECT share_id FROM marketplace.crm_market_answers WHERE request_id=$1 AND state IN ('waiting','chosen') ORDER BY id")
        .bind(request).fetch_all(&mut **tx).await?;
    for share in shares {
        listings::marketplace::end(tx, share, actor).await?;
    }
    sqlx::query("UPDATE marketplace.crm_market_answers SET state='not_chosen',decided_at=now() WHERE request_id=$1 AND state IN ('waiting','chosen')")
        .bind(request).execute(&mut **tx).await?;
    Ok(())
}
