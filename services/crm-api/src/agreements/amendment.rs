//! Proposals preserve accepted terms; expiry belongs to the proposal, not the agreement.
use super::{
    command,
    evidence::Place,
    introduction, ledger, lifecycle_view, limits,
    model::Kind,
    payment_store, store,
    write::{self, NewRevision},
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
use time::OffsetDateTime;

pub async fn propose(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let mut cmd = command::begin(
        &state,
        &session,
        &headers,
        &workspace,
        &id,
        body,
        &["expectedVersion", "terms"],
    )
    .await?;
    if cmd.row.state != "accepted" {
        return Err(ApiError::conflict(
            "Only accepted agreements can be amended.",
        ));
    }
    if lifecycle_view::proposal(&mut cmd.tx, &cmd.row)
        .await?
        .is_some_and(|p| p["expired"] == false)
    {
        return Err(ApiError::conflict("Answer the existing amendment first."));
    }
    let kind = Kind::parse(&cmd.row.kind)?;
    let current = store::current(&mut cmd.tx, cmd.row.id).await?;
    let now = OffsetDateTime::now_utc();
    let built = introduction::rebuild(kind, &cmd.body["terms"], &current.terms, now)?;
    if kind == Kind::CoBroking && built.value["money"]["collectingParty"].is_null() {
        return Err(ApiError::invalid("Choose the company collecting the fee."));
    }
    limits::ensure(
        &mut cmd.tx,
        kind,
        &built.value,
        (&cmd.row.workspace_id, true),
    )
    .await?;
    payment_store::ensure_amendment(&mut cmd.tx, &cmd.row, &built.value).await?;
    let number: i32=sqlx::query_scalar(
        "SELECT COALESCE(max(number),0)+1 FROM agreements.crm_agreement_revisions WHERE agreement_id=$1")
        .bind(cmd.row.id).fetch_one(&mut *cmd.tx).await?;
    let parties = cmd.row.parties();
    let (revision, digest) = write::insert_revision(
        &mut cmd.tx,
        NewRevision {
            place: Place {
                agreement: cmd.row.id,
                number,
                parent: Some(current.id),
            },
            parties: &parties,
            author: cmd.party.as_str(),
            created_by: cmd.actor,
        },
        &built,
    )
    .await?;
    let version = sqlx::query_scalar::<_, i64>(
        "UPDATE agreements.crm_agreements SET proposed_revision_id=$2,
         cancel_sender_revision_id=NULL,cancel_recipient_revision_id=NULL,
         version=version+1,updated_at=now() WHERE id=$1 RETURNING version",
    )
    .bind(cmd.row.id)
    .bind(revision)
    .fetch_one(&mut *cmd.tx)
    .await?;
    ledger::event(
        &mut cmd.tx,
        cmd.row.id,
        Some(revision),
        "amendment_proposed",
        cmd.actor,
        cmd.party,
    )
    .await?;
    cmd.commit(
        "accepted",
        version,
        json!({"revision":{"id":revision,"number":number,"digest":digest}}),
    )
    .await
}
