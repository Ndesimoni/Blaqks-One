//! Writing a request in place (packet MK2): an edit with the version the poster last saw, which
//! keeps the expiry date, and a renewal that sets thirty days from now.
use super::request::Valid;
use super::requests::{Row, COLUMNS, STAMPS};
use crate::error::ApiResult;
use sqlx::{types::Json, Postgres, Transaction};
use uuid::Uuid;

/// An edit with the version the poster last saw. An open request keeps its expiry date.
pub async fn edit(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    member: Uuid,
    expected: i64,
    valid: &Valid,
) -> ApiResult<Option<Row>> {
    Ok(sqlx::query_as(&format!(
        "UPDATE marketplace.crm_market_requests SET purpose=$4,emirate=$5,communities=$6, \
         open_to_other_areas=$7,property_type=$8,bedrooms=$9,budget_min_aed=$10, \
         budget_max_aed=$11,budget_band=$12,ready=$13,furnishing=$14,cheques=$15, \
         building_age=$16,move_in=$17,updated_at=now(),version=version+1 \
         WHERE id=$1 AND member_id=$2 AND version=$3 AND closed_at IS NULL \
         RETURNING {COLUMNS},{STAMPS}"
    ))
    .bind(id)
    .bind(member)
    .bind(expected)
    .bind(&valid.purpose)
    .bind(&valid.emirate)
    .bind(Json(valid.communities.clone()))
    .bind(valid.open_to_other_areas)
    .bind(&valid.property_type)
    .bind(valid.bedrooms)
    .bind(valid.budget_min_aed)
    .bind(valid.budget_max_aed)
    .bind(&valid.band)
    .bind(&valid.ready)
    .bind(&valid.furnishing)
    .bind(valid.cheques)
    .bind(&valid.building_age)
    .bind(&valid.move_in)
    .fetch_optional(&mut **tx)
    .await?)
}

/// Thirty days from now, for an open request or one that expired less than thirty days ago.
pub async fn renew(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    member: Uuid,
) -> ApiResult<Option<Row>> {
    Ok(sqlx::query_as(&format!(
        "UPDATE marketplace.crm_market_requests SET expires_at=now()+interval '30 days', \
         updated_at=now(),version=version+1 \
         WHERE id=$1 AND member_id=$2 AND closed_at IS NULL \
           AND expires_at > now()-interval '30 days' \
         RETURNING {COLUMNS},{STAMPS}"
    ))
    .bind(id)
    .bind(member)
    .fetch_optional(&mut **tx)
    .await?)
}
