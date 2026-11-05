//! Stored client requests (packet MK2): insert, load, edit and renew, plus the state a screen
//! reads. The row never carries the source client; that lives beside it in
//! `crm_market_request_sources`, which only the poster's side reads.
use super::{profile::Community, request::Valid};
use crate::error::{ApiError, ApiResult};
use sqlx::{types::Json, Postgres, Transaction};
use uuid::Uuid;

pub(super) const COLUMNS: &str = "id,workspace_id,member_id,purpose,emirate,communities,\
open_to_other_areas,property_type,bedrooms,budget_min_aed,budget_max_aed,budget_band,ready,\
furnishing,cheques,building_age,move_in,version";

pub(super) const STAMPS: &str =
    "to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') \
     AS created_at, \
     to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS expires_at, \
     to_char(closed_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS closed_at, \
     to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS cursor_at, \
    close_reason, paused_at::text AS paused_at, closed_at IS NULL AND expires_at <= now() AS expired, \
     closed_at IS NULL AND expires_at > now() - interval '30 days' AS renewable";
#[derive(Debug, sqlx::FromRow)]
pub struct Row {
    pub paused_at: Option<String>,
    pub id: Uuid,
    pub workspace_id: String,
    pub member_id: Uuid,
    pub purpose: String,
    pub emirate: String,
    pub communities: Json<Vec<Community>>,
    pub open_to_other_areas: bool,
    pub property_type: String,
    pub bedrooms: Option<i16>,
    pub budget_min_aed: Option<i64>,
    pub budget_max_aed: i64,
    pub budget_band: String,
    pub ready: String,
    pub furnishing: String,
    pub cheques: Option<i16>,
    pub building_age: String,
    pub move_in: Option<String>,
    pub version: i64,
    pub created_at: String,
    /// `created_at` to the microsecond, so a board cursor never skips a row in the same millisecond.
    pub cursor_at: String,
    pub expires_at: String,
    pub closed_at: Option<String>,
    pub close_reason: Option<String>,
    pub expired: bool,
    pub renewable: bool,
}

/// `open`, `expired` or `closed`: what My requests shows beside each row.
pub fn state(row: &Row) -> &'static str {
    if row.closed_at.is_some() {
        "closed"
    } else if row.expired {
        "expired"
    } else if row.paused_at.is_some() {
        "paused"
    } else {
        "open"
    }
}

/// The board's filters, validated by the route before they reach the query.
#[derive(Debug, Default)]
pub struct Filters {
    pub purpose: Option<String>,
    pub emirate: Option<String>,
    pub property_type: Option<String>,
    pub bedrooms: Option<i16>,
    pub band: Option<String>,
}

pub async fn insert(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    member: Uuid,
    valid: &Valid,
) -> ApiResult<Row> {
    Ok(sqlx::query_as(&format!(
        "INSERT INTO marketplace.crm_market_requests (id,workspace_id,member_id,purpose, \
         emirate,communities,open_to_other_areas,property_type,bedrooms,budget_min_aed, \
         budget_max_aed,budget_band,ready,furnishing,cheques,building_age,move_in, \
         client_consent_at,expires_at) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now(), \
           now()+interval '30 days') \
         RETURNING {COLUMNS},{STAMPS}"
    ))
    .bind(Uuid::new_v4())
    .bind(workspace)
    .bind(member)
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
    .fetch_one(&mut **tx)
    .await?)
}

pub async fn load(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<Option<Row>> {
    Ok(sqlx::query_as(&format!(
        "SELECT {COLUMNS},{STAMPS} FROM marketplace.crm_market_requests WHERE id=$1"
    ))
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?)
}

/// One of the member's own requests, or the shared not-found.
pub async fn own_row(tx: &mut Transaction<'_, Postgres>, id: Uuid, member: Uuid) -> ApiResult<Row> {
    load(tx, id)
        .await?
        .filter(|row| row.member_id == member)
        .ok_or_else(ApiError::missing)
}

/// The member's own requests, newest first.
pub async fn own(tx: &mut Transaction<'_, Postgres>, member: Uuid) -> ApiResult<Vec<Row>> {
    Ok(sqlx::query_as(&format!(
        "SELECT {COLUMNS},{STAMPS} FROM marketplace.crm_market_requests \
         WHERE member_id=$1 ORDER BY created_at DESC,id DESC"
    ))
    .bind(member)
    .fetch_all(&mut **tx)
    .await?)
}
