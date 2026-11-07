//! `GET …/marketplace/requests/mine` (packet MK2): the poster's own requests, newest first, with
//! the client and its name from the caller's own view. A request whose client moved away is closed
//! here (`client_changed`), because the board hides it before anyone else sees it.
use super::{events, gate, request_view, requests, requests_close, sources};
use crate::{
    auth::session::Session,
    error::ApiResult,
    records::{lookup, market_requirements},
    state::AppState,
};
use axum::{
    extract::{Path, State as AxumState},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use uuid::Uuid;

pub async fn mine(
    AxumState(state): AxumState<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let user = gate::live_member(&mut tx, &workspace, session.user.id).await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    let rows = requests::own(&mut tx, user.id).await?;
    let clients: HashMap<Uuid, Uuid> = sources::clients_of(&mut tx, user.id)
        .await?
        .into_iter()
        .collect();
    let stale = changed(&rows, &clients, &mut tx, &workspace, user.id).await?;
    for _ in &stale {
        events::append(&mut tx, &workspace, user.id, user.id, "request_closed").await?;
    }
    requests_close::close_changed(&mut tx, &stale).await?;
    let rows = match stale.is_empty() {
        true => rows,
        false => requests::own(&mut tx, user.id).await?,
    };
    let mut items = Vec::with_capacity(rows.len());
    for row in &rows {
        let client = clients.get(&row.id).copied();
        let name = match client {
            Some(id) => lookup::summary(&mut tx, &workspace, &user, "Clients", id)
                .await?
                .and_then(|summary| summary.name),
            None => None,
        };
        items.push(request_view::mine(row, client, name.as_deref()));
    }
    tx.commit().await?;
    Ok(Json(json!({ "requests": items })))
}

/// The open requests whose client the poster no longer holds.
async fn changed(
    rows: &[requests::Row],
    clients: &HashMap<Uuid, Uuid>,
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    workspace: &str,
    member: Uuid,
) -> ApiResult<Vec<Uuid>> {
    let triples: Vec<(String, Uuid, Uuid)> = rows
        .iter()
        .filter(|row| row.closed_at.is_none())
        .filter_map(|row| clients.get(&row.id))
        .map(|client| (workspace.to_owned(), *client, member))
        .collect();
    let held = market_requirements::still_held(tx, &triples).await?;
    let mut stale = Vec::new();
    for row in rows.iter().filter(|row| row.closed_at.is_none()) {
        if let Some(client) = clients.get(&row.id) {
            if !held.contains(client) {
                stale.push(row.id);
            }
        }
    }
    Ok(stale)
}
