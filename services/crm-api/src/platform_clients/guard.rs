//! Who reaches Blaqks One's own clients: the Owner, and live platform members with the
//! `clients` area (reads View, changes Manage). The session is checked before anything is
//! parsed, and the live account is re-read inside the route's transaction.
use crate::{
    auth::{profile::UserRow, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::platform::{self, Area, Level},
};
use axum::http::HeaderMap;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub(super) type Tx = Transaction<'static, Postgres>;

async fn open(state: &AppState, session: &Session, level: Level) -> ApiResult<(Tx, UserRow)> {
    if !platform::areas::allows(&session.user, Area::Clients, level) {
        return Err(ApiError::forbidden());
    }
    let mut tx = state.pool.begin().await?;
    let live = platform::operator(&mut tx, session.user.id, Area::Clients, level).await?;
    Ok((tx, live))
}

/// A read: the clients area at View.
pub(super) async fn read(state: &AppState, session: &Session) -> ApiResult<(Tx, UserRow)> {
    open(state, session, Level::View).await
}

/// A change: the clients area at Manage, from the CRM's own origin with the session's
/// CSRF token.
pub(super) async fn write(
    state: &AppState,
    session: &Session,
    headers: &HeaderMap,
) -> ApiResult<(Tx, UserRow)> {
    if !platform::areas::allows(&session.user, Area::Clients, Level::Manage) {
        return Err(ApiError::forbidden());
    }
    protection::mutation(state, headers, &session.csrf_token)?;
    open(state, session, Level::Manage).await
}

/// A client ID from the path; anything else is not found.
pub(super) fn id(raw: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(raw).map_err(|_| ApiError::missing())
}
