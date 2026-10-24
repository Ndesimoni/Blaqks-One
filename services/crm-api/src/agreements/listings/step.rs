//! One command on a listing share: the caller's workspace lock and live profile, then the
//! share row (closed first if its time has passed), and the caller's required place in it;
//! anyone else gets not-found. `finish` answers with the share as the caller now reads it.
use super::{
    access::{self, Caller, Viewer},
    places, read,
    store::{self, ShareRow},
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{http::HeaderMap, Json};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const NOT_WAITING: &str = "This share is no longer waiting for an answer.";
pub const NOT_OPEN: &str = "This share has already ended.";
pub const PAUSED: &str = "This listing isn't available right now.";

pub struct Step<'t> {
    pub tx: Transaction<'t, Postgres>,
    pub row: ShareRow,
    pub actor: Uuid,
    pub workspace: String,
    pub admin: bool,
}

impl Step<'_> {
    /// Refuses a command on a share in the wrong state, keeping the closing that the lock
    /// may just have recorded for a share past its time.
    pub async fn refuse(self, message: &'static str) -> ApiResult<Json<Value>> {
        self.tx.commit().await?;
        Err(ApiError::conflict(message))
    }

    /// Commits and answers with the share as the caller now reads it.
    pub async fn finish(mut self) -> ApiResult<Json<Value>> {
        let row = store::find(&mut self.tx, self.row.id)
            .await?
            .ok_or_else(ApiError::missing)?;
        let caller = Caller {
            id: self.actor,
            workspace: &self.workspace,
            admin: self.admin,
        };
        let share = read::one_view(&mut self.tx, &row, &caller).await?;
        self.tx.commit().await?;
        Ok(Json(json!({ "share": share })))
    }
}

/// Opens a step on share `id` for a caller who must be `needed` to it.
pub async fn begin<'t>(
    state: &'t AppState,
    session: &Session,
    headers: &HeaderMap,
    path: (String, String),
    needed: Viewer,
) -> ApiResult<Step<'t>> {
    let (step, viewer) = open(state, session, headers, path).await?;
    if viewer != Some(needed) {
        return Err(ApiError::missing());
    }
    Ok(step)
}

/// Opens a step on share `id` with the caller's place in it; no place is the not-found.
pub async fn open<'t>(
    state: &'t AppState,
    session: &Session,
    headers: &HeaderMap,
    (workspace, id): (String, String),
) -> ApiResult<(Step<'t>, Option<Viewer>)> {
    access::writer(state, session, headers, &workspace).await?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = access::live(&mut tx, &workspace, session.user.id).await?;
    let row = store::locked(&mut tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    let caller = Caller {
        id: live.id,
        workspace: &workspace,
        admin: live.role == "admin",
    };
    let viewer = places::one(&mut tx, &row, &caller).await?;
    if viewer.is_none() {
        return Err(ApiError::missing());
    }
    let admin = caller.admin;
    let step = Step {
        tx,
        row,
        actor: live.id,
        workspace,
        admin,
    };
    Ok((step, viewer))
}

pub async fn close(
    mut step: Step<'_>,
    status: &str,
    from: &str,
    side: &str,
) -> ApiResult<Json<Value>> {
    if step.row.status != from {
        return step
            .refuse(if from == "pending" {
                NOT_WAITING
            } else {
                NOT_OPEN
            })
            .await;
    }
    sqlx::query(
        "UPDATE agreements.crm_listing_shares SET status=$2,closed_at=now(),closed_by=$3 \
         WHERE id=$1",
    )
    .bind(step.row.id)
    .bind(status)
    .bind(step.actor)
    .execute(&mut *step.tx)
    .await?;
    store::event(
        &mut step.tx,
        step.row.id,
        status,
        Some((step.actor, side)),
        (None, None),
    )
    .await?;
    step.finish().await
}
