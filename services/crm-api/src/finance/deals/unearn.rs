//! `POST /finance/deals/{id}/unearn {version, reason}` (Admin, finance-design §2.4, §13
//! M-F4): only without approved payments; the snapshot stays as superseded history.
use super::{
    gate::{self, Need, STALE},
    list,
    revise::NOT_EARNED,
    row, snapshot,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{
        admin,
        events::{self, Action, Changes, Entity},
        wire,
    },
    records::audit,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub const PAYMENTS: &str = "Void this deal's approved payments first.";
const INVALID: &str = "Provide a version and a reason.";

pub async fn unearn(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace, Need::Manage).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let body = wire::exact(body, &["version", "reason"], INVALID)?;
    let version = gate::version(&body["version"])?;
    let reason = gate::reason(&body["reason"])?;
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Manage).await?;
    let deal = row::locked(&mut tx, &workspace, &live, id).await?;
    if deal.version != version {
        return Err(ApiError::stale(STALE));
    }
    if !deal.earned() {
        return Err(ApiError::conflict(NOT_EARNED));
    }
    if deal.approved_fils > 0 {
        return Err(ApiError::conflict(PAYMENTS));
    }
    admin::admin_path(&mut tx, &live).await?;
    let superseded = snapshot::supersede(&mut tx, deal.id, &reason).await?;
    sqlx::query(
        "UPDATE crm_deals SET earned_on=NULL,version=version+1,updated_at=now() WHERE id=$1",
    )
    .bind(deal.id)
    .execute(&mut *tx)
    .await?;
    let changes = Changes::default()
        .pair("earnedOn", deal.earned_on.clone(), Value::Null)
        .pair("revision", superseded.map(|s| s.revision), Value::Null);
    let (ws, actor) = (workspace.as_str(), live.id);
    let action = Action::Unearned;
    events::append(
        &mut tx,
        ws,
        Entity::Deal,
        deal.id,
        action,
        actor,
        changes,
        Some(&reason),
    )
    .await?;
    audit::append(&mut tx, actor, ws, "unearned", "Deals", deal.id).await?;
    let entry = list::entry(&mut tx, &workspace, &live, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "deal": entry })))
}
