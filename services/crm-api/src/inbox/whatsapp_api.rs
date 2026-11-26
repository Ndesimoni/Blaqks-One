//! WhatsApp routes of the Inbox (W1b, design §10 and §18): consent for a visible
//! conversation (`POST …/conversations/{id}/consent`) or a visible record (`POST
//! /inbox/whatsapp/consent`, with the `expectedPhone` the member confirmed), and the Start
//! message state (`GET /inbox/whatsapp/start`). Replies name the number the consent is for.
//! Writes take the workspace lock and re-read the live member (H4); hidden, foreign and
//! malformed IDs are the same not-found.
use super::{
    access::{self, Viewer},
    composer,
    consent::{self, Change, Via},
    read::load,
    send::{whatsapp, whatsapp_target as target},
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    records::recipient,
    state::AppState,
    workspaces,
};
use axum::{
    extract::{
        rejection::{JsonRejection, QueryRejection},
        Path, Query, State,
    },
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

type Body = Result<Json<Value>, JsonRejection>;

fn map(body: Body) -> ApiResult<serde_json::Map<String, Value>> {
    match body {
        Ok(Json(Value::Object(map))) => Ok(map),
        _ => Err(ApiError::invalid(consent::INVALID)),
    }
}

/// `POST /inbox/conversations/{id}/consent` `{change, source?, reason?}`.
pub async fn conversation(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Body,
) -> ApiResult<Json<Value>> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let id = access::id(&id)?;
    let change = consent::parse(&map(body)?)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    load(&mut tx, &workspace, &Viewer::of(&user), id, true)
        .await?
        .ok_or_else(ApiError::missing)?;
    let thread = whatsapp::thread(&mut tx, id).await?;
    if thread.channel != "whatsapp" {
        return Err(ApiError::invalid(
            "Agreement applies to WhatsApp conversations.",
        ));
    }
    let key = thread.contact_key;
    reply(tx, &workspace, &key, &user, (change, Via::Conversation(id))).await
}

/// `POST /inbox/whatsapp/consent` `{collection, recordId, change, source?, reason?}`.
pub async fn record(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Body,
) -> ApiResult<Json<Value>> {
    access::ensure_writer(&state, &session, &headers, &workspace).await?;
    let mut map = map(body)?;
    let (collection, record) = target::record(&mut map)?;
    let expected = target::expected(&mut map);
    let change = consent::parse(&map)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let found = recipient::recipient(&mut tx, &workspace, &user, &collection, record)
        .await?
        .ok_or_else(ApiError::missing)?;
    // The member confirms the number the CRM derived from the record (review M1).
    let key = target::confirmed(found.phone.as_deref(), expected.as_deref())?;
    let via = Via::Record(&collection, record);
    reply(tx, &workspace, &key, &user, (change, via)).await
}

async fn reply(
    mut tx: sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    key: &str,
    user: &crate::auth::profile::UserRow,
    (change, via): (Change, Via<'_>),
) -> ApiResult<Json<Value>> {
    let current = consent::record(&mut tx, workspace, key, user, change, via).await?;
    tx.commit().await?;
    let consent = consent::view(current.as_ref(), user);
    Ok(Json(json!({ "consent": consent, "phone": key })))
}

#[derive(Deserialize)]
pub struct StartQuery {
    collection: String,
    #[serde(rename = "recordId")]
    record_id: String,
}

/// `GET /inbox/whatsapp/start?collection=…&recordId=…`.
pub async fn start(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    query: Result<Query<StartQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_member(&state, &session, &workspace).await?;
    let Ok(Query(query)) = query else {
        return Err(ApiError::missing());
    };
    let record = Uuid::parse_str(&query.record_id).map_err(|_| ApiError::missing())?;
    let mut tx = state.pool.begin().await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let found = composer::start(&mut tx, &workspace, &user, &query.collection, record).await?;
    tx.commit().await?;
    found.map(Json).ok_or_else(ApiError::missing)
}
