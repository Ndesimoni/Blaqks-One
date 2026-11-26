//! `GET /inbox/summary`: what the sidebar badge, the tab counts and the Inbox banners need:
//! visible conversations with unread inbound messages (spam excluded), active ones held by
//! the viewer and Unassigned ones, and each channel's connection state, without labels or
//! account IDs.
use super::access::{self, predicate, Viewer};
use crate::{auth::session::Session, error::ApiResult, integrations, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};

pub async fn summary(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure_member(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let viewer = Viewer::of(&access::live(&mut tx, &workspace, session.user.id).await?);
    let sql = format!(
        "SELECT count(*) FILTER (WHERE c.state<>'spam' AND EXISTS (SELECT 1 \
             FROM inbox.crm_inbox_messages m WHERE m.conversation_id=c.id \
             AND m.direction='inbound' AND m.created_at>coalesce((SELECT r.read_at \
             FROM inbox.crm_inbox_reads r WHERE r.conversation_id=c.id AND r.member_id=$5), \
             '-infinity'::timestamptz))), \
           count(*) FILTER (WHERE c.assignee_id=$5 AND c.state IN ('new','open','waiting')), \
           count(*) FILTER (WHERE c.assignee_id IS NULL AND c.state IN ('new','open','waiting')) \
         FROM inbox.crm_inbox_conversations c WHERE c.workspace_id=$1 AND {}",
        predicate("c", "$2", "$3", "$4"),
    );
    let (unread, mine, unassigned): (i64, i64, i64) = sqlx::query_as(&sql)
        .bind(&workspace)
        .bind(viewer.caller)
        .bind(viewer.whatsapp)
        .bind(viewer.email)
        .bind(viewer.id)
        .fetch_one(&mut *tx)
        .await?;
    let channels: Vec<Value> = integrations::channel_states(&mut tx, &workspace)
        .await?
        .into_iter()
        .map(|(channel, state)| json!({"channel": channel, "state": state}))
        .collect();
    tx.commit().await?;
    Ok(Json(json!({
        "unread": unread,
        "mine": mine,
        "unassigned": unassigned,
        "channels": channels,
    })))
}
