//! Initiation uses only the caller's matching inventory and derives the recipient.
use super::{
    answer_access, conversation_access as access, conversation_routes::Message,
    conversation_store as store, gate, limits, matching,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub async fn start(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    Json(input): Json<Message>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace).await?;
    let body = access::body(&input.body)?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_writer(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    let row = access::request(&mut tx, limits::missing_id(&id)?).await?;
    access::open(&row)?;
    if row.workspace_id == workspace || row.member_id == user.id {
        return Err(ApiError::missing());
    }
    if answer_access::active_count(&mut tx, row.id).await? >= 3 {
        return Err(ApiError::conflict("This request has three active offers."));
    }
    if !matching::own_matches(&mut tx, &user, &row)
        .await?
        .is_empty()
    {
        return Err(ApiError::conflict(
            "Offer a matching property instead of starting a no-match conversation.",
        ));
    }
    let count:i64=sqlx::query_scalar("SELECT count(*) FROM marketplace.crm_market_conversations WHERE broker_id=$1 AND created_at>now()-interval '1 day'")
        .bind(user.id).fetch_one(&mut *tx).await?;
    if count >= 20 {
        return Err(ApiError::conflict(
            "Today's new conversation limit has been reached.",
        ));
    }
    let room:Uuid=sqlx::query_scalar("INSERT INTO marketplace.crm_market_conversations(id,request_id,broker_id,broker_workspace) VALUES($1,$2,$3,$4) ON CONFLICT(request_id,broker_id) DO UPDATE SET updated_at=now() RETURNING id")
        .bind(Uuid::new_v4()).bind(row.id).bind(user.id).bind(&workspace).fetch_one(&mut *tx).await?;
    store::append(&mut tx, room, user.id, &body).await?;
    super::events::append(
        &mut tx,
        &workspace,
        user.id,
        user.id,
        "conversation_started",
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({"conversationId":room})))
}
