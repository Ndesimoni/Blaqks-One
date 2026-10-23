//! The request and the checks of sending a listing share (docs/record-sharing.md R2). The
//! agent is an active member of another live company (found by exact email through
//! `POST /agreements/recipients`); one open share per listing and agent; at most 100 shares
//! per member a day. Checked before the photos are copied and again under the locks.
use super::dates;
use crate::{
    agreements::wire,
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use axum::{extract::rejection::JsonRejection, http::StatusCode, Json};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use time::OffsetDateTime;
use uuid::Uuid;

pub const INVALID: &str = "Provide a listing, an agent, a last day and the reviewed preview.";
pub const RECIPIENT: &str = "This agent can't receive listings from you.";
pub const DUPLICATE: &str = "This listing is already shared with that agent.";
pub const DAILY: &str = "You have shared 100 listings today. Try again tomorrow.";
pub const CHANGED: &str = "This listing just changed. Review it again.";

pub struct Input {
    pub record: Uuid,
    pub to_workspace: String,
    pub to: Uuid,
    /// The end of the last day, RFC 3339.
    pub view_ends: String,
    pub exact: bool,
    pub note: Option<String>,
    pub preview: String,
}

const KEYS: [&str; 7] = [
    "recordId",
    "recipientWorkspaceId",
    "recipientMemberId",
    "viewEndsOn",
    "exactLocation",
    "note",
    "previewDigest",
];

pub fn parse(body: Result<Json<Value>, JsonRejection>, now: OffsetDateTime) -> ApiResult<Input> {
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let map = wire::exact(body, &KEYS, INVALID)?;
    let field = |key: &str| map.get(key).ok_or(ApiError::invalid(INVALID));
    let text = |key: &str| field(key)?.as_str().ok_or(ApiError::invalid(INVALID));
    let note = match field("note")? {
        Value::Null => None,
        value => Some(wire::text(value, 500).map_err(|_| ApiError::invalid(INVALID))?),
    };
    let to_workspace = text("recipientWorkspaceId")?;
    if to_workspace.is_empty() || to_workspace.len() > 100 {
        return Err(ApiError::invalid(INVALID));
    }
    Ok(Input {
        record: wire::uuid(field("recordId")?).map_err(|_| ApiError::missing())?,
        to_workspace: to_workspace.to_owned(),
        to: wire::uuid(field("recipientMemberId")?).map_err(|_| ApiError::invalid(RECIPIENT))?,
        view_ends: dates::stamp(dates::last_day(text("viewEndsOn")?, now)?)?,
        exact: field("exactLocation")?
            .as_bool()
            .ok_or(ApiError::invalid(INVALID))?,
        note,
        preview: text("previewDigest")?.to_owned(),
    })
}

/// Checks the agent, the daily limit and duplicates; `lock` also locks both member rows
/// `FOR SHARE`, last in the lock order, so neither leaves before the share commits.
pub async fn check(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    input: &Input,
    lock: bool,
) -> ApiResult<()> {
    if input.to_workspace == workspace || input.to == live.id {
        return Err(ApiError::invalid(RECIPIENT));
    }
    if lock {
        crate::records::shares::locks::members(tx, &[live.id, input.to]).await?;
    }
    let agent: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_user_profiles WHERE id=$1 AND workspace_id=$2 \
         AND active AND owner_active AND role<>'super-admin')",
    )
    .bind(input.to)
    .bind(&input.to_workspace)
    .fetch_one(&mut **tx)
    .await?;
    if !agent {
        return Err(ApiError::invalid(RECIPIENT));
    }
    let today: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM agreements.crm_listing_shares WHERE workspace_id=$1 \
         AND from_id=$2 AND created_at>now()-interval '24 hours'",
    )
    .bind(workspace)
    .bind(live.id)
    .fetch_one(&mut **tx)
    .await?;
    if today >= 100 {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            DAILY,
            "rate_limited",
        ));
    }
    sqlx::query(
        "SELECT agreements.crm_listing_shares_lapse(ARRAY(SELECT id FROM \
         agreements.crm_listing_shares WHERE workspace_id=$1 AND source_record_id=$2 \
         AND to_id=$3 AND status IN ('pending','accepted')))",
    )
    .bind(workspace)
    .bind(input.record)
    .bind(input.to)
    .execute(&mut **tx)
    .await?;
    let open: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM agreements.crm_listing_shares WHERE workspace_id=$1 \
         AND source_record_id=$2 AND to_id=$3 AND status IN ('pending','accepted'))",
    )
    .bind(workspace)
    .bind(input.record)
    .bind(input.to)
    .fetch_one(&mut **tx)
    .await?;
    if open {
        return Err(ApiError::conflict(DUPLICATE));
    }
    Ok(())
}
