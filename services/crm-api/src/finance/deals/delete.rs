//! `DELETE /finance/deals/{id} {version}` (Admin, finance-design §6.2): only deals that
//! were never earned; any remaining reference keeps the generic foreign-key 409.
use super::{
    gate::{self, Need, STALE},
    row,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{
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

pub const EVER_EARNED: &str = "Only deals that were never earned can be deleted.";

pub async fn delete(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace, Need::Manage).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(gate::VERSION))?;
    let body = wire::exact(body, &["version"], gate::VERSION)?;
    let version = gate::version(&body["version"])?;
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Manage).await?;
    let deal = row::locked(&mut tx, &workspace, &live, id).await?;
    if deal.version != version {
        return Err(ApiError::stale(STALE));
    }
    if deal.ever_earned {
        return Err(ApiError::conflict(EVER_EARNED));
    }
    sqlx::query("DELETE FROM crm_deals WHERE id=$1")
        .bind(deal.id)
        .execute(&mut *tx)
        .await?;
    let changes = Changes::default()
        .pair("dealId", deal.legacy_id.clone(), Value::Null)
        .pair("agreedValueFils", deal.agreed_value_fils, Value::Null);
    let (ws, actor) = (workspace.as_str(), live.id);
    events::append(
        &mut tx,
        ws,
        Entity::Deal,
        deal.id,
        Action::Deleted,
        actor,
        changes,
        None,
    )
    .await?;
    audit::append(&mut tx, actor, ws, "deleted", "Deals", deal.id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "deleted": deal.id })))
}
