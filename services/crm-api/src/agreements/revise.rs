//! Draft edits and counter-offers (docs/agreements-design.md §3–§4). Both seal a new
//! revision; earlier revisions and their evidence never change. A counter-offer is
//! an answer, so it needs an open (sent, unexpired) revision like accept and decline.
use super::{
    access,
    command::{self, Command},
    errors,
    evidence::Place,
    ledger,
    model::{Kind, Party, State as AgreementState},
    store, terms,
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

const KEYS: [&str; 2] = ["expectedVersion", "terms"];

async fn freeze(
    mut command: Command,
    author: Party,
    next_state: &'static str,
    action: &str,
) -> ApiResult<Json<Value>> {
    let row = command.row.clone();
    let kind = Kind::parse(&row.kind)?;
    let input = command.body.get("terms").cloned().unwrap_or(Value::Null);
    let built = terms::build(kind, &input, OffsetDateTime::now_utc())?;
    let current = store::current(&mut command.tx, row.id).await?;
    let parties = row.parties();
    let revision = NewRevision {
        place: Place {
            agreement: row.id,
            number: current.number + 1,
            parent: Some(current.id),
        },
        parties: &parties,
        author,
        created_by: command.actor,
    };
    let tx = &mut command.tx;
    let (revision, digest) = write::insert_revision(tx, revision, &built).await?;
    let expires = Some(built.expires_at);
    let version =
        ledger::bump(tx, row.id, row.version, next_state, expires, Some(revision)).await?;
    ledger::event(tx, row.id, Some(revision), action, command.actor, author).await?;
    let number = current.number + 1;
    let extra = json!({ "revision": { "id": revision, "number": number, "digest": digest } });
    command.commit(next_state, version, extra).await
}

pub async fn edit(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let command = command::begin(&state, &session, &headers, &workspace, &id, body, &KEYS).await?;
    access::require(command.party, Party::Sender)?;
    if command.row.state() != AgreementState::Draft {
        return Err(ApiError::conflict(errors::FROZEN));
    }
    freeze(command, Party::Sender, "draft", "revised").await
}

pub async fn counter(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    let mut command =
        command::begin(&state, &session, &headers, &workspace, &id, body, &KEYS).await?;
    let current = store::current(&mut command.tx, command.row.id).await?;
    let author = current.author().other();
    access::require(command.party, author)?;
    command.ensure_open()?;
    freeze(command, author, "sent", "countered").await
}
