//! `GET /api/crm/workspaces/{ws}/activity` (docs/team-activity-design.md). Check order:
//! session (401), workspace access (one 403), permission parameters (403), syntax and
//! ranges (400), then one REPEATABLE READ READ ONLY snapshot that re-reads the live
//! member, repeats the permission checks on it and reads each owner's page. The
//! organisation has no records, so its path goes to Blaqks One's own team feed instead.
use super::{dates, query::Params, respond::respond, window::Window};
use crate::{
    auth::{profile::UserRow, session::Session},
    error::ApiResult,
    integrations::activity::page as channel_page,
    records::activity::{feed_collections, page as record_page},
    state::AppState,
    team::audit::page as team_page,
    workspaces::{ensure_access, member, ORGANISATION},
};
use axum::{
    extract::{Path, RawQuery, State},
    Json,
};
use serde_json::Value;
use uuid::Uuid;

/// Upper keyset bound when no cursor is given: everything before the next Dubai day.
const NEWEST: Uuid = Uuid::max();

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    RawQuery(raw): RawQuery,
) -> ApiResult<Json<Value>> {
    if workspace == ORGANISATION {
        return super::organisation::list(&state, &session, raw.as_deref()).await;
    }
    ensure_access(&state, &session, &workspace).await?;
    let params = Params::parse(raw.as_deref());
    params.authorise(&session.user, &workspace, &feed_collections(&session.user))?;
    let filters = params.validate(dates::today())?;
    let mut transaction = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *transaction)
        .await?;
    let user = member(&mut transaction, &workspace, session.user.id).await?;
    let granted = feed_collections(&user);
    params.authorise(&user, &workspace, &granted)?;
    let end = (dates::start_micros(filters.days.1 + 1), NEWEST);
    let window = Window {
        workspace,
        from_micros: dates::start_micros(filters.days.0),
        upper: filters.cursor.map_or(end, |position| position.min(end)),
        actor: own_actor(&user, filters.actor),
        action: filters.action,
        fetch: filters.limit + 1,
    };
    let kind = filters.kind.as_deref();
    let collections: Vec<&str> = match &filters.collection {
        Some(collection) => vec![collection.as_str()],
        None => granted,
    };
    let mut items = if matches!(kind, Some("team" | "channel")) {
        Vec::new()
    } else {
        record_page(&mut transaction, &window, &collections, &user).await?
    };
    // A collection filter names records, so it excludes team and channel events.
    let unfiltered = filters.collection.is_none();
    if unfiltered && matches!(kind, None | Some("team")) {
        items.extend(team_page(&mut transaction, &window, &user).await?);
    }
    if unfiltered && matches!(kind, None | Some("channel")) {
        items.extend(channel_page(&mut transaction, &window, &user).await?);
    }
    transaction.commit().await?;
    Ok(Json(respond(items, filters.limit)))
}

/// Assigned-only staff always read their own actions, whatever the request named.
fn own_actor(user: &UserRow, requested: Option<Uuid>) -> Option<Uuid> {
    if user.has_team_scope() {
        requested
    } else {
        Some(user.id)
    }
}
