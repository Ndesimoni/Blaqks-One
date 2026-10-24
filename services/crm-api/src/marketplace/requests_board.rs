//! The board's page query (packet MK2): every joined company's open, unexpired requests, the
//! caller's own company included (owner, 2026-10-24), newest first, narrowed by the validated
//! filters (a request for any bedroom count matches every bedroom filter) and continued after an
//! opaque cursor. The board route then applies the marketplace visibility rule to what comes back.
use super::requests::{Filters, Row, COLUMNS, STAMPS};
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn board_page(
    tx: &mut Transaction<'_, Postgres>,
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
         WHERE r.closed_at IS NULL AND r.expires_at > now() \
           AND ($1::text IS NULL OR r.purpose = $1) \
           AND ($2::text IS NULL OR r.emirate = $2) \
           AND ($3::text IS NULL OR r.property_type = $3) \
           AND ($4::smallint IS NULL OR r.bedrooms = $4 OR r.bedrooms IS NULL) \
           AND ($5::text IS NULL OR r.budget_band = $5) \
           AND ($6::timestamptz IS NULL OR (r.created_at, r.id) < ($6::timestamptz, $7::uuid)) \
         ORDER BY r.created_at DESC, r.id DESC LIMIT $8"
    ))
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
