//! Accept and decline (docs/agreements-design.md §4): only the party who did not
//! author the current revision may answer it, and only while it is sent and unexpired.
//! Acceptance stores the exact revision's evidence digest.
use super::{
    access,
    command::{self, Command},
    ledger::{self, Response},
    store,
};
use crate::{
    auth::session::Session,
    error::ApiResult,
    platform_metrics::{self, names, Event, Source},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};

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
    if accepted {
        super::listings::market_release::accept(tx, id, revision.id, &revision.digest).await?;
        if command.row.workspace_id != command.row.recipient_workspace_id {
            money_events(tx, &revision.terms).await?;
        }
    }
    let extra = if accepted {
        json!({ "digest": revision.digest })
    } else {
        json!({})
    };
    command.commit(action, version, extra).await
}

/// An agreement between two companies was accepted: the deal's value and the commission
/// being shared go to the platform log as amounts only, never with either company (BO1d).
async fn money_events(tx: &mut Transaction<'_, Postgres>, terms: &Value) -> ApiResult<()> {
    let amount = |at| terms.pointer(at).and_then(Value::as_i64).unwrap_or(0);
    let value = amount("/subject/property/askingPriceFils");
    let value = Event::money(names::AGREEMENT_ACCEPTED, value, Source::Crm);
    platform_metrics::record(tx, value).await?;
    let shared = amount("/money/amountFils");
    let shared = Event::money(names::COMMISSION_SHARED, shared, Source::Crm);
    platform_metrics::record(tx, shared).await
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
