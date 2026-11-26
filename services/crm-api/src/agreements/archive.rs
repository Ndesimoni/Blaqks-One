//! `POST /agreements/{id}/archive {expectedVersion}` (docs/agreements-a3b.md): a live
//! company Admin hides their own company's side of a draft or sent cross-company agreement.
//! The other company's view and every piece of evidence stay; in-company hand-overs are
//! never archived.
use super::{
    access, ledger,
    model::{Party, STALE},
    store, wire,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub const ADMIN_ONLY: &str = "Only your Admin can archive an agreement.";

pub async fn archive(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let body = wire::exact(body, &["expectedVersion"], wire::INVALID)?;
    let expected = wire::version(&body)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let live =
        workspaces::ensure_writable(&mut tx, &workspace, session.user.id, None, None).await?;
    let row = store::load_locked(&mut tx, access::id(&id)?)
        .await?
        .filter(|row| access::can_read(row, &session, &workspace))
        .ok_or(ApiError::missing())?;
    // The Deals origin lock answers first, as for every command (design §14 amendments).
    if row.handover() {
        return Err(ApiError::conflict(super::errors::HANDOVER));
    }
    if live.role != "admin" {
        return Err(ApiError::denied(ADMIN_ONLY));
    }
    if row.version != expected {
        return Err(ApiError::stale(STALE));
    }
    if !matches!(row.state.as_str(), "draft" | "sent") {
        return Err(ApiError::conflict(
            "Only drafts and sent offers can be archived.",
        ));
    }
    let sender = workspace == row.workspace_id;
    let version=sqlx::query_scalar::<_,i64>(
        "UPDATE agreements.crm_agreements SET sender_archived_at=CASE WHEN $2 THEN now()
         ELSE sender_archived_at END,recipient_archived_at=CASE WHEN NOT $2 THEN now()
         ELSE recipient_archived_at END,version=version+1,updated_at=now() WHERE id=$1 RETURNING version")
        .bind(row.id).bind(sender).fetch_one(&mut *tx).await?;
    ledger::event(
        &mut tx,
        row.id,
        row.current_revision_id,
        "archived",
        live.id,
        if sender {
            Party::Sender
        } else {
            Party::Recipient
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(json!({"state":row.state,"version":version})))
}
