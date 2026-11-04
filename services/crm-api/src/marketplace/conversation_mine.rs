//! The member's own broker conversations across requests, for Messages → Marketplace chats
//! (design queue): each with the request's shared facts, the other broker, the latest message
//! and whether the request still takes messages. Every row passes the same participant, company
//! and visibility checks as opening the conversation itself; hidden ones are left out.
use super::{conversation_access as access, gate, request_view};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

const PREVIEW: usize = 140;
const PAGE: i64 = 50;

#[derive(Default, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Page {
    offset: Option<i64>,
}

pub async fn mine(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    query: Result<Query<Page>, axum::extract::rejection::QueryRejection>,
) -> ApiResult<Json<Value>> {
    let Query(page) =
        query.map_err(|_| crate::error::ApiError::invalid("Provide a valid chat page."))?;
    let offset = page.offset.unwrap_or(0);
    if !(0..=10_000).contains(&offset) {
        return Err(crate::error::ApiError::invalid(
            "Provide a valid chat page.",
        ));
    }
    gate::reader(&state, &session, &workspace).await?;
    let me = session.user.id;
    let mut tx = state.pool.begin().await?;
    gate::live_member(&mut tx, &workspace, me).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, me).await?;
    let mut rooms: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT c.id,c.updated_at::text FROM marketplace.crm_market_conversations c \
         JOIN marketplace.crm_market_requests r ON r.id=c.request_id \
         WHERE c.broker_id=$1 OR r.member_id=$1 ORDER BY c.updated_at DESC,c.id DESC \
         LIMIT $2 OFFSET $3",
    )
    .bind(me)
    .bind(PAGE + 1)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;
    let has_more = rooms.len() as i64 > PAGE;
    rooms.truncate(PAGE as usize);
    let mut items = Vec::new();
    for (id, updated) in rooms {
        let (room, row) = match access::load_read(&mut tx, id, me).await {
            Ok(found) => found,
            Err(error) if error.0 == StatusCode::NOT_FOUND => continue,
            Err(error) => return Err(error),
        };
        let other = if me == row.member_id {
            room.broker_id
        } else {
            row.member_id
        };
        let Some(profile) = super::visibility::visible(&mut tx, other).await? else {
            continue;
        };
        let last: Option<(String, String)> = sqlx::query_as(
            "SELECT body,created_at::text FROM marketplace.crm_market_messages \
             WHERE conversation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",
        )
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
        let closed = row.closed_at.is_some() || row.expired;
        items.push(json!({
            "id": id,
            "request": request_view::facts(&row),
            "participantId": other,
            "participantName": profile.name,
            "mine": me == row.member_id,
            "updatedAt": updated,
            "lastMessage": last.map(|(body, at)| json!({
                "body": body.chars().take(PREVIEW).collect::<String>(),
                "createdAt": at,
            })),
            "closed": closed,
            "canReply": !closed,
        }));
    }
    tx.commit().await?;
    let next = has_more.then_some(offset + PAGE);
    Ok(Json(json!({ "conversations": items, "nextOffset": next })))
}
