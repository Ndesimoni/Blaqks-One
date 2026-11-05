//! The shared start of every agreement command (docs/agreements-design.md §4, §9):
//! CSRF, an exact body with `expectedVersion`, the caller's workspace lock, a live
//! membership re-check, the agreement row lock, then participant and version checks.
//! Party checks run before any state check, so non-parties learn nothing. In-company
//! hand-overs change only through Deals (design §14), so every command here refuses them.
use super::{
    access, errors::HANDOVER, model::Party, model::STALE, rows::AgreementRow, store, wire,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{extract::rejection::JsonRejection, http::HeaderMap, Json};
use serde_json::{json, Map, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const EXPIRED: &str = "This agreement has expired.";
pub const NOT_SENT: &str = "Only a sent agreement can take this action.";

pub struct Command {
    pub tx: Transaction<'static, Postgres>,
    pub row: AgreementRow,
    pub party: Party,
    pub actor: Uuid,
    pub body: Map<String, Value>,
}

/// `keys` lists the body fields; it always includes `expectedVersion`.
pub async fn begin(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: &str,
    id: &str,
    body: Result<Json<Value>, JsonRejection>,
    keys: &[&str],
) -> ApiResult<Command> {
    access::ensure_writer(state, session, headers, workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let body = wire::exact(body, keys, wire::INVALID)?;
    let expected = wire::version(&body)?;
    let id = access::id(id)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, workspace).await?;
    let live = workspaces::ensure_writable(&mut tx, workspace, session.user.id, None, None).await?;
    let row = store::load_locked(&mut tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    let party = access::acting_party(&row, session, workspace)?;
    if row.handover() {
        return Err(ApiError::conflict(HANDOVER));
    }
    if row.version != expected {
        return Err(ApiError::stale(STALE));
    }
    Ok(Command {
        tx,
        row,
        party,
        actor: live.id,
        body,
    })
}

impl Command {
    /// A sent revision that has not expired: the only one that can be answered.
    pub fn ensure_open(&self) -> ApiResult<()> {
        if self.row.state() != super::model::State::Sent {
            return Err(ApiError::conflict(NOT_SENT));
        }
        if self.row.expired {
            return Err(ApiError::conflict(EXPIRED));
        }
        Ok(())
    }

    /// Commits and returns the new state and version for the caller's next command.
    pub async fn commit(self, state: &str, version: i64, extra: Value) -> ApiResult<Json<Value>> {
        self.tx.commit().await?;
        let mut reply = json!({ "state": state, "version": version });
        if let (Value::Object(reply), Value::Object(extra)) = (&mut reply, extra) {
            reply.extend(extra);
        }
        Ok(Json(reply))
    }
}
