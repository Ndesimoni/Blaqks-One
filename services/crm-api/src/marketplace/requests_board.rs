//! The board's page query (packet MK2): another company's open, unexpired requests, newest first,
//! narrowed by the validated filters (a request for any bedroom count matches every bedroom
//! filter) and continued after an opaque cursor. The board route then applies the marketplace
//! visibility rule to what comes back.
use super::requests::{Filters, Row, COLUMNS, STAMPS};
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn board_page(
    tx: &mut Transaction<'_, Postgres>,
    caller_workspace: &str,
    filters: &Filters,
    after: Option<(&str, Uuid)>,
    limit: i64,
) -> ApiResult<Vec<Row>> {
    let (at, id) = match after {
        Some((at, id)) => (Some(at), Some(id)),
        None => (None, None),
    };
    Ok(sqlx::query_as(&format!(
        "SELECT {COLUMNS},{STAMPS} FROM marketplace.crm_market_requests r \
         WHERE r.workspace_id <> $1 AND r.closed_at IS NULL AND r.expires_at > now() \
           AND ($2::text IS NULL OR r.purpose = $2) \
           AND ($3::text IS NULL OR r.emirate = $3) \
           AND ($4::text IS NULL OR r.property_type = $4) \
           AND ($5::smallint IS NULL OR r.bedrooms = $5 OR r.bedrooms IS NULL) \
           AND ($6::text IS NULL OR r.budget_band = $6) \
           AND ($7::timestamptz IS NULL OR (r.created_at, r.id) < ($7::timestamptz, $8::uuid)) \
         ORDER BY r.created_at DESC, r.id DESC LIMIT $9"
    ))
    .bind(caller_workspace)
    .bind(&filters.purpose)
    .bind(&filters.emirate)
    .bind(&filters.property_type)
    .bind(filters.bedrooms)
    .bind(&filters.band)
    .bind(at)
    .bind(id)
    .bind(limit)
    .fetch_all(&mut **tx)
    .await?)
}
