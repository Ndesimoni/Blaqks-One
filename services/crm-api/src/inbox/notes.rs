//! `POST /inbox/conversations/{id}/read` marks the conversation read for the caller, and
//! `POST /inbox/conversations/{id}/notes` adds an internal note. Notes live in their own
//! table, so no mistake in a payload can ever send one to a client.
use super::{
    access::{self, Viewer},
    read::load,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub const NOTE: &str = "Write a note of up to 4,000 characters.";

pub async fn mark_read(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<StatusCode> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    // Live membership is checked after the workspace lock, so an archive cannot race it.
    workspaces::lock(&mut tx, &workspace).await?;
    let viewer = Viewer::of(&access::live(&mut tx, &workspace, session.user.id).await?);
    load(&mut tx, &workspace, &viewer, id, false)
        .await?
        .ok_or_else(ApiError::missing)?;
    sqlx::query(
        "INSERT INTO inbox.crm_inbox_reads (conversation_id,member_id,read_at) \
         VALUES ($1,$2,now()) ON CONFLICT (conversation_id,member_id) DO UPDATE SET read_at=now()",
    )
    .bind(id)
    .bind(viewer.id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

/// The trimmed note text, 1–4,000 characters, from exactly `{"body": "..."}`.
pub fn note_body(body: Value) -> ApiResult<String> {
    let Value::Object(map) = body else {
        return Err(ApiError::invalid(NOTE));
    };
    if map.len() != 1 {
        return Err(ApiError::invalid(NOTE));
    }
    map.get("body")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty() && text.chars().count() <= 4000)
        .map(str::to_owned)
        .ok_or(ApiError::invalid(NOTE))
}

pub async fn add_note(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let id = access::id(&id)?;
    let Json(body) = body.map_err(|_| ApiError::invalid(NOTE))?;
    let text = note_body(body)?;
    let mut tx = state.pool.begin().await?;
    // Live membership is checked after the workspace lock, so an archive cannot race it.
    workspaces::lock(&mut tx, &workspace).await?;
    let viewer = Viewer::of(&access::live(&mut tx, &workspace, session.user.id).await?);
    load(&mut tx, &workspace, &viewer, id, false)
        .await?
        .ok_or_else(ApiError::missing)?;
    let note = Uuid::new_v4();
    let at: String = sqlx::query_scalar(
        "INSERT INTO inbox.crm_inbox_notes (id,conversation_id,workspace_id,author_user_id,body) \
         VALUES ($1,$2,$3,$4,$5) \
         RETURNING to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
    )
    .bind(note)
    .bind(id)
    .bind(&workspace)
    .bind(viewer.id)
    .bind(&text)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    let view = json!({"id": note, "authorId": viewer.id, "body": text, "at": at});
    Ok((StatusCode::CREATED, Json(json!({"note": view}))))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn notes_are_one_trimmed_bounded_text() {
        assert_eq!(
            note_body(json!({"body": "  Call back after 5  "})).unwrap(),
            "Call back after 5"
        );
        for bad in [
            json!({"body": "   "}),
            json!({"body": "x".repeat(4001)}),
            json!({"body": 5}),
            json!({"body": "ok", "send": true}),
            json!("text"),
        ] {
            assert!(note_body(bad).is_err());
        }
    }
}
