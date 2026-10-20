//! The common start of every conversation action: Origin and CSRF, a strict body with
//! `expectedVersion`, the workspace lock, the live member and the visible conversation
//! locked at that version. Callers then make their change and [`finish`].
use super::{
    access::{self, Viewer},
    events,
    read::load,
    view::{shown, Row},
};
use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{extract::rejection::JsonRejection, http::HeaderMap, Json};
use serde_json::{json, Map, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const INVALID: &str = "Provide a valid conversation action.";
pub const RELOAD: &str = "Reload the conversation and try again.";

pub struct Locked {
    pub tx: Transaction<'static, Postgres>,
    pub workspace: String,
    pub user: UserRow,
    pub viewer: Viewer,
    pub row: Row,
}

/// The body's fields besides `expectedVersion`; only `allowed` keys may appear.
pub fn fields(body: Value, allowed: &[&str]) -> ApiResult<(i64, Map<String, Value>)> {
    let Value::Object(mut map) = body else {
        return Err(ApiError::invalid(INVALID));
    };
    let version = map
        .remove("expectedVersion")
        .and_then(|value| value.as_i64())
        .filter(|version| *version > 0)
        .ok_or(ApiError::invalid(INVALID))?;
    if map.keys().any(|key| !allowed.contains(&key.as_str())) {
        return Err(ApiError::invalid(INVALID));
    }
    Ok((version, map))
}

pub async fn begin(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
    workspace: String,
    id: &str,
    version: i64,
) -> ApiResult<Locked> {
    access::ensure_writer(state, session, headers, &workspace).await?;
    let id = access::id(id)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    let user = access::live(&mut tx, &workspace, session.user.id).await?;
    let viewer = Viewer::of(&user);
    let row = load(&mut tx, &workspace, &viewer, id, true)
        .await?
        .ok_or_else(ApiError::missing)?;
    if row.version != version {
        return Err(ApiError::stale(RELOAD));
    }
    Ok(Locked {
        tx,
        workspace,
        user,
        viewer,
        row,
    })
}

impl Locked {
    pub fn id(&self) -> Uuid {
        self.row.id
    }

    pub async fn event(&mut self, action: &str) -> ApiResult<()> {
        let (workspace, id, actor) = (self.workspace.clone(), self.row.id, self.viewer.id);
        events::append(&mut self.tx, &workspace, id, Some(actor), action).await
    }

    /// Commits and answers with the conversation as the caller now sees it.
    pub async fn finish(mut self) -> ApiResult<Json<Value>> {
        let after = load(
            &mut self.tx,
            &self.workspace,
            &self.viewer,
            self.row.id,
            false,
        )
        .await?;
        let view = match &after {
            Some(row) => Some(shown(&mut self.tx, &self.workspace, &self.user, row).await?),
            None => None,
        };
        self.tx.commit().await?;
        Ok(Json(json!({"conversation": view})))
    }
}

pub type Body = Result<Json<Value>, JsonRejection>;

/// An optional trimmed text of at most `max` characters.
pub fn optional_text(value: Option<&Value>, max: usize) -> ApiResult<Option<String>> {
    match value {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(text)) if text.chars().count() <= max => {
            Ok(Some(text.trim().to_owned()))
        }
        Some(_) => Err(ApiError::invalid(INVALID)),
    }
}

pub fn json(body: Body) -> ApiResult<Value> {
    body.map(|Json(value)| value)
        .map_err(|_| ApiError::invalid(INVALID))
}
