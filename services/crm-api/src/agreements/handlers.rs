//! `POST/GET /agreements` and `GET /agreements/{id}` (docs/agreements-design.md
//! §9–§10): participant-scoped reads, drafts created by the named sender.
use super::{access, evidence::Parties, model::Kind, store, terms, wire, write};
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
use time::OffsetDateTime;

const AGREEMENT: [&str; 3] = ["kind", "recipient", "terms"];
const RECIPIENT: [&str; 2] = ["workspaceId", "memberId"];

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let input = wire::exact(body, &["agreement"], wire::INVALID)?;
    let agreement = wire::node(&input, "agreement")?.clone();
    let input = wire::exact(agreement, &AGREEMENT, wire::INVALID)?;
    let kind = Kind::parse(&wire::text(wire::node(&input, "kind")?, 40)?)?;
    let recipient = wire::node(&input, "recipient")?.clone();
    let recipient = wire::exact(recipient, &RECIPIENT, wire::INVALID)?;
    let recipient_workspace = wire::text(wire::node(&recipient, "workspaceId")?, 100)?;
    let recipient_member = wire::uuid(wire::node(&recipient, "memberId")?)?;
    let now = OffsetDateTime::now_utc();
    let built = terms::build(kind, wire::node(&input, "terms")?, now)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let live =
        workspaces::ensure_writable(&mut tx, &workspace, session.user.id, None, None).await?;
    store::ensure_recipient(&mut tx, &workspace, &recipient_workspace, recipient_member).await?;
    let parties = Parties {
        sender_workspace: workspace.clone(),
        sender_member: live.id,
        recipient_workspace,
        recipient_member,
    };
    let id = write::insert_draft(&mut tx, &parties, kind.as_str(), live.id, &built).await?;
    let row = store::load(&mut tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "agreement": row.view() })),
    ))
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure_reader(&state, &session, &workspace).await?;
    let admin = session.user.role == "admin";
    let mut tx = state.pool.begin().await?;
    let rows = store::list(&mut tx, &workspace, session.user.id, admin).await?;
    tx.commit().await?;
    let items: Vec<Value> = rows.iter().map(|row| row.view()).collect();
    Ok(Json(json!({ "agreements": items })))
}

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    access::ensure_reader(&state, &session, &workspace).await?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let row = store::load(&mut tx, id)
        .await?
        .filter(|row| access::can_read(row, &session, &workspace))
        .ok_or_else(ApiError::missing)?;
    let revision = store::current(&mut tx, id).await?;
    tx.commit().await?;
    let party = access::party_of(&row, session.user.id, &workspace).map(|party| party.as_str());
    Ok(Json(json!({
        "agreement": row.view(),
        "revision": revision.view(),
        "party": party,
    })))
}
