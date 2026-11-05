//! Blaqks One's own team feed (BO1a, owner answer Q6): the organisation's team events (the
//! company Admins it invited, suspended or archived) for the live operator only, until the
//! platform activity log exists. No records or channels and never a company's feed, since
//! `workspaces::ensure_access` refuses the organisation on every data route.
use super::{dates, query::Params, respond::respond, window::Window};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    team::audit::page as team_page,
    workspaces::{platform, ORGANISATION},
};
use axum::Json;
use serde_json::Value;
use uuid::Uuid;

pub async fn list(
    state: &AppState,
    session: &Session,
    raw: Option<&str>,
) -> ApiResult<Json<Value>> {
    if session.user.role != "super-admin" {
        return Err(ApiError::forbidden());
    }
    let params = Params::parse(raw);
    if !params.team_only() {
        return Err(ApiError::forbidden());
    }
    let filters = params.validate(dates::today())?;
    let mut transaction = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *transaction)
        .await?;
    let operator = platform::operator(&mut transaction, session.user.id).await?;
    let end = (dates::start_micros(filters.days.1 + 1), Uuid::max());
    let window = Window {
        workspace: ORGANISATION.into(),
        from_micros: dates::start_micros(filters.days.0),
        upper: filters.cursor.map_or(end, |position| position.min(end)),
        actor: filters.actor,
        action: filters.action,
        fetch: filters.limit + 1,
    };
    let items = team_page(&mut transaction, &window, &operator).await?;
    transaction.commit().await?;
    Ok(Json(respond(items, filters.limit)))
}
