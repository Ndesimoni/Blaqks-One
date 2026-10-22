//! Accept and decline (docs/agreements-design.md §4): only the party who did not
//! author the current revision may answer it, and only while it is sent and unexpired.
//! Acceptance stores the exact revision's evidence digest.
use super::{
    access,
    command::{self, Command},
    ledger::{self, Response},
    store,
};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

const VERSION: [&str; 1] = ["expectedVersion"];

async fn answer(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    path: (String, String),
    body: Result<Json<Value>, JsonRejection>,
    action: &'static str,
) -> ApiResult<Json<Value>> {
    let (workspace, id) = path;
    let mut command: Command =
        command::begin(state, session, headers, &workspace, &id, body, &VERSION).await?;
    let id = command.row.id;
    let revision = store::current(&mut command.tx, id).await?;
    let responder = revision.author()?.other();
    access::require(command.party, responder)?;
    command.ensure_open()?;
    let accepted = action == "accepted";
    let tx = &mut command.tx;
    let version = ledger::bump(tx, id, command.row.version, action, None, None).await?;
    let response = Response {
        agreement: id,
        revision: revision.id,
        action,
        actor: command.actor,
        party: responder,
        accepted_digest: accepted.then_some(revision.digest.as_str()),
    };
    ledger::respond(tx, &response).await?;
    let extra = if accepted {
        json!({ "digest": revision.digest })
    } else {
        json!({})
    };
    command.commit(action, version, extra).await
}

pub async fn accept(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    answer(&state, &session, &headers, path, body, "accepted").await
}

pub async fn decline(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    answer(&state, &session, &headers, path, body, "declined").await
}
