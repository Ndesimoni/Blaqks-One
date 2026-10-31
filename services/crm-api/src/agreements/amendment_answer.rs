//! Answer exactly the outstanding amendment; insert acceptance before promoting it.
use super::{
    access, command,
    ledger::{self, Response},
    lifecycle_view, payment_store, wire,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

async fn answer(
    state: AppState,
    session: Session,
    headers: HeaderMap,
    path: (String, String),
    body: Result<Json<Value>, JsonRejection>,
    accept: bool,
) -> ApiResult<Json<Value>> {
    let mut cmd = command::begin(
        &state,
        &session,
        &headers,
        &path.0,
        &path.1,
        body,
        &["expectedVersion", "revisionId"],
    )
    .await?;
    let revision = wire::uuid(&cmd.body["revisionId"])?;
    if cmd.row.state != "accepted" || cmd.row.proposed_revision_id != Some(revision) {
        return Err(ApiError::conflict("This amendment is no longer available."));
    }
    let proposal = lifecycle_view::proposal(&mut cmd.tx, &cmd.row)
        .await?
        .ok_or(ApiError::missing())?;
    if proposal["expired"] == true {
        return Err(ApiError::conflict(command::EXPIRED));
    }
    let author = match proposal["authorParty"].as_str() {
        Some("sender") => super::model::Party::Sender,
        _ => super::model::Party::Recipient,
    };
    access::require(cmd.party, author.other())?;
    if accept {
        payment_store::ensure_amendment(&mut cmd.tx, &cmd.row, &proposal["terms"]).await?;
    }
    ledger::respond(
        &mut cmd.tx,
        &Response {
            agreement: cmd.row.id,
            revision,
            action: if accept { "accepted" } else { "declined" },
            actor: cmd.actor,
            party: cmd.party,
            accepted_digest: if accept {
                proposal["digest"].as_str()
            } else {
                None
            },
        },
    )
    .await?;
    let version = sqlx::query_scalar::<_, i64>(
        "UPDATE agreements.crm_agreements SET current_revision_id=CASE WHEN $3 THEN $2
         ELSE current_revision_id END,proposed_revision_id=NULL,
         cancel_sender_revision_id=NULL,cancel_recipient_revision_id=NULL,
         version=version+1,updated_at=now() WHERE id=$1 RETURNING version",
    )
    .bind(cmd.row.id)
    .bind(revision)
    .bind(accept)
    .fetch_one(&mut *cmd.tx)
    .await?;
    cmd.commit("accepted", version, json!({})).await
}

pub async fn accept(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    answer(state, session, headers, path, body, true).await
}
pub async fn decline(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    answer(state, session, headers, path, body, false).await
}
