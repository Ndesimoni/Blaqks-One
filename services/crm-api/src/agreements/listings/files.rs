//! `GET /agreements/listing-shares/{id}/files/{file}` (R2 security review 2): access first,
//! then only a file the snapshot names, looked up by the snapshot's own company and ID,
//! never by the path's workspace. The sender's side reads them while the copies are kept;
//! the agent only while the share is accepted and open; the receiving Admin never. A copy
//! reused from an earlier snapshot of the same listing is served from that snapshot.
use super::{
    access::{self, Caller, Viewer},
    places, snapshot_store, store,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    media::{copies::KIND, copy_reuse, serve},
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
    let allowed = match places::one(&mut tx, &row, &caller).await? {
        Some(Viewer::Sender) => true,
        Some(Viewer::Agent) => row.origin == "direct" && row.shown_to_agent(),
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
    let (workspace, record) = (&row.workspace_id, row.source_record_id);
    let holder = copy_reuse::holder(&mut tx, workspace, file).await?;
    let Some(holder) = holder else {
        return Err(ApiError::missing());
    };
    if !snapshot_store::of_listing(&mut tx, holder, workspace, record).await? {
        return Err(ApiError::missing());
    }
    let response = serve::file(&state, &mut tx, workspace, KIND, holder, file).await?;
    tx.commit().await?;
    Ok(response)
}
