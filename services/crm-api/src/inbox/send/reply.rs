//! `POST /inbox/conversations/{id}/messages`: reply by email in a visible conversation,
//! through the caller's own mailbox, which must be the conversation's mailbox (O9).
use super::{body, files, object, same_mailbox, sender, store, BODY};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    inbox::{
        access::{self, Viewer},
        drafts, events,
        read::load,
    },
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};

pub async fn reply(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    request: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let id = access::id(&id)?;
    let Json(mut request) = request.map_err(|_| ApiError::invalid(BODY))?;
    let attachments = files::take(&mut request)?;
    let text = body(&object(request, &["body"], BODY)?, "body")?;
    let mut tx = state.pool.begin().await?;
    // Live membership and grants are read after the workspace lock (H4).
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let viewer = Viewer::of(&user);
    load(&mut tx, &workspace, &viewer, id, true)
        .await?
        .ok_or_else(ApiError::missing)?;
    let mailbox = sender(&mut tx, &workspace, &user).await?;
    same_mailbox(&store::thread(&mut tx, id).await?, mailbox)?;
    let mut message = store::queue(&mut tx, &workspace, id, user.id, &text, None).await?;
    let files = files::attach(
        &mut tx,
        &workspace,
        user.id,
        mailbox,
        &message,
        &attachments,
    );
    message["attachments"] = json!(files.await?);
    events::append(&mut tx, &workspace, id, Some(user.id), "replied").await?;
    // The writer's draft is emptied with the send (docs/saved-replies-drafts.md, H1).
    let draft = drafts::sent(&mut tx, id, user.id).await?;
    tx.commit().await?;
    let sent = json!({ "message": message, "draftRevision": draft });
    Ok((StatusCode::CREATED, Json(sent)))
}
