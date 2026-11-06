//! `GET /inbox/conversations/{id}`: one visible conversation with its latest 200 messages,
//! internal notes, the linked record as far as the viewer may see it, and on WhatsApp the
//! composer's state (W1b). Notes are a separate list and never part of anything a client
//! receives.
use super::{
    access::{self, predicate, Viewer},
    view::{Row, COLUMNS},
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    records::lookup,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

const STAMP: &str = "to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')";

/// The visible conversation `id`, optionally locked; hidden and foreign rows are `None`.
pub async fn load(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    viewer: &Viewer,
    id: Uuid,
    lock: bool,
) -> ApiResult<Option<Row>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM inbox.crm_inbox_conversations c \
         WHERE c.workspace_id=$1 AND c.id=$6 AND {} {}",
        predicate("c", "$2", "$3", "$4"),
        if lock { "FOR UPDATE OF c" } else { "" },
    );
    sqlx::query_as(&sql)
        .bind(workspace)
        .bind(viewer.caller)
        .bind(viewer.whatsapp)
        .bind(viewer.email)
        .bind(viewer.id)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

#[derive(FromRow)]
struct Note {
    id: Uuid,
    author_user_id: Uuid,
    body: String,
    at: String,
}

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    access::ensure_member(&state, &session, &workspace).await?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let viewer = Viewer::of(&user);
    let row = load(&mut tx, &workspace, &viewer, id, false)
        .await?
        .ok_or_else(ApiError::missing)?;
    let messages = super::read_messages::messages(&mut tx, id).await?;
    let notes: Vec<Note> = sqlx::query_as(&format!(
        "SELECT id,author_user_id,body,{STAMP} AS at FROM inbox.crm_inbox_notes \
         WHERE conversation_id=$1 ORDER BY created_at,id"
    ))
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    let mut record_visible = false;
    let record = match (&row.linked_collection, row.linked_record_id) {
        (Some(collection), Some(record)) => {
            let seen = lookup::summary(&mut tx, &workspace, &user, collection, record).await?;
            record_visible = seen.is_some();
            Some(match seen {
                Some(summary) => json!({"collection": collection, "recordId": record,
                    "legacyId": summary.legacy_id, "name": summary.name}),
                None => json!({"collection": collection, "unavailable": true}),
            })
        }
        _ => None,
    };
    // The WhatsApp composer's window, agreement and template states (W1b).
    let whatsapp = match row.channel.as_str() {
        "whatsapp" => super::composer::conversation(&mut tx, &workspace, &user, id).await?,
        _ => Value::Null,
    };
    tx.commit().await?;
    let notes: Vec<Value> = notes
        .iter()
        .map(|n| {
            json!({
                "id": n.id, "authorId": n.author_user_id, "body": n.body, "at": n.at,
            })
        })
        .collect();
    let mut conversation = row.view(record_visible);
    conversation["record"] = record.unwrap_or(Value::Null);
    conversation["whatsapp"] = whatsapp;
    Ok(Json(
        json!({"conversation": conversation, "messages": messages, "notes": notes}),
    ))
}
