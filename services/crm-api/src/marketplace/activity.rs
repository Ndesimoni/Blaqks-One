//! Recent requests involving the caller remain discoverable after leaving the board.
use super::{gate, request_view, requests, visibility};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    gate::live_member(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, session.user.id).await?;
    let ids:Vec<Uuid>=sqlx::query_scalar("SELECT r.id FROM marketplace.crm_market_requests r WHERE EXISTS(SELECT 1 FROM marketplace.crm_market_answers a WHERE a.request_id=r.id AND a.member_id=$1) OR EXISTS(SELECT 1 FROM marketplace.crm_market_conversations c WHERE c.request_id=r.id AND c.broker_id=$1) ORDER BY r.updated_at DESC,r.id DESC LIMIT 50")
        .bind(session.user.id).fetch_all(&mut *tx).await?;
    let mut items = Vec::new();
    for id in ids {
        let Some(row) = requests::load(&mut tx, id).await? else {
            continue;
        };
        if visibility::visible(&mut tx, row.member_id).await?.is_none() {
            continue;
        }
        let mut item = request_view::facts(&row);
        item.insert("requestId".into(), json!(id));
        item.insert("state".into(), json!(requests::state(&row)));
        item.insert("version".into(), json!(row.version));
        item.insert("isPoster".into(), json!(false));
        items.push(Value::Object(item));
    }
    tx.commit().await?;
    Ok(Json(json!({"requests":items})))
}
