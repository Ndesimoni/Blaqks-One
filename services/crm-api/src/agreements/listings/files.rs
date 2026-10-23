//! `GET /agreements/listing-shares/{id}/files/{file}` (R2 security review 2): access first,
//! then only a file the snapshot names, looked up by the snapshot's own company and ID,
//! never by the path's workspace. The sender's side reads them while the copies are kept;
//! the agent only while the share is accepted and open; the receiving Admin never.
use super::{
    access::{self, Caller, Viewer},
    read, store,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    media::{copies::KIND, serve},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    response::Response,
};
use serde_json::Value;
use uuid::Uuid;

pub async fn file(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id, file)): Path<(String, String, String)>,
) -> ApiResult<Response> {
    access::reader(&state, &session, &workspace).await?;
    let (id, file) = (access::id(&id)?, access::id(&file)?);
    let caller = Caller::of(&session, &workspace);
    let mut tx = state.pool.begin().await?;
    let row = store::find(&mut tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    let allowed = match read::viewer(&row, &caller) {
        Some(Viewer::Sender) => true,
        Some(Viewer::Agent) => row.status == "accepted",
        _ => false,
    };
    let named = row.media.as_array().into_iter().flatten().any(|entry| {
        ["file", "thumb"].iter().any(|key| {
            entry
                .get(*key)
                .and_then(Value::as_str)
                .and_then(|text| Uuid::parse_str(text).ok())
                == Some(file)
        })
    });
    if !allowed || !named {
        return Err(ApiError::missing());
    }
    let response = serve::file(
        &state,
        &mut tx,
        &row.workspace_id,
        KIND,
        row.snapshot_id,
        file,
    )
    .await?;
    tx.commit().await?;
    Ok(response)
}
