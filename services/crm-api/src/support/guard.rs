//! Who reaches help requests. A company member works only in their own company and only on
//! their own requests; the Blaqks One side needs the Owner or the `help_requests` area
//! (reads View, answers and changes Manage). Writes also pass Origin and CSRF. The live
//! account is re-read inside the route's transaction.
use crate::{
    auth::{profile::UserRow, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{
        self,
        platform::{self, Area, Level},
    },
};
use axum::http::HeaderMap;
use sqlx::{Postgres, Transaction};

pub(super) type Tx = Transaction<'static, Postgres>;

/// A company member (Admin or staff) in their own workspace.
pub(super) async fn member(
    state: &AppState,
    session: &Session,
    headers: Option<&HeaderMap>,
    workspace: &str,
) -> ApiResult<(Tx, UserRow)> {
    workspaces::ensure_access(state, session, workspace).await?;
    if let Some(headers) = headers {
        protection::mutation(state, headers, &session.csrf_token)?;
    }
    let mut tx = state.pool.begin().await?;
    let live = workspaces::member(&mut tx, workspace, session.user.id).await?;
    Ok((tx, live))
}

/// The Blaqks One team with Help requests at `level`.
pub(super) async fn team(
    state: &AppState,
    session: &Session,
    headers: Option<&HeaderMap>,
    level: Level,
) -> ApiResult<(Tx, UserRow)> {
    if !platform::areas::allows(&session.user, Area::HelpRequests, level) {
        return Err(ApiError::forbidden());
    }
    if let Some(headers) = headers {
        protection::mutation(state, headers, &session.csrf_token)?;
    }
    let mut tx = state.pool.begin().await?;
    let live = platform::operator(&mut tx, session.user.id, Area::HelpRequests, level).await?;
    Ok((tx, live))
}
