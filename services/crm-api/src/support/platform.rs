//! The Blaqks One side's queue: `GET /api/crm/platform/help?state=&assigned=me` lists
//! requests with counts per state; `GET …/help/summary` counts open requests for the badge;
//! `GET …/help/people` lists who a request can be assigned to.
use super::{guard, input, view};
use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{
        platform::{areas, Area, Level},
        ORGANISATION,
    },
};
use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct QueueQuery {
    state: Option<String>,
    assigned: Option<String>,
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Query(query): Query<QueueQuery>,
) -> ApiResult<Json<Value>> {
    let wanted = query.state.clone().unwrap_or_else(|| "open".into());
    if wanted != "all" && !input::STATES.contains(&wanted.as_str()) {
        return Err(ApiError::invalid("Choose Open, Waiting, Solved or All."));
    }
    let (mut tx, live) = guard::team(&state, &session, None, Level::View).await?;
    let mine = match query.assigned.as_deref() {
        None | Some("all") => None,
        Some("me") => Some(live.id),
        Some(_) => return Err(ApiError::invalid("Choose me or all.")),
    };
    let rows = view::queue(&mut tx, &wanted, mine).await?;
    let requests = view::shaped(&mut tx, &rows).await?;
    let counts = view::counts(&mut tx).await?;
    tx.commit().await?;
    Ok(Json(json!({ "requests": requests, "counts": counts })))
}

pub async fn summary(State(state): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    let (mut tx, _) = guard::team(&state, &session, None, Level::View).await?;
    let counts = view::counts(&mut tx).await?;
    tx.commit().await?;
    Ok(Json(json!({ "open": counts["open"] })))
}

/// The Owner and the live team members who answer help requests (Manage).
pub(super) async fn helpers(tx: &mut Transaction<'_, Postgres>) -> ApiResult<Vec<UserRow>> {
    let people = sqlx::query_as::<_, UserRow>(
        "SELECT * FROM crm_user_profiles WHERE workspace_id=$1 AND active AND owner_active \
         AND role IN ('super-admin','platform') ORDER BY name,id",
    )
    .bind(ORGANISATION)
    .fetch_all(&mut **tx)
    .await?;
    Ok(people
        .into_iter()
        .filter(|person| areas::allows(person, Area::HelpRequests, Level::Manage))
        .collect())
}

pub async fn people(State(state): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    let (mut tx, _) = guard::team(&state, &session, None, Level::View).await?;
    let people: Vec<Value> = helpers(&mut tx)
        .await?
        .into_iter()
        .map(|person| json!({"id": person.id, "name": person.name}))
        .collect();
    tx.commit().await?;
    Ok(Json(json!({ "people": people })))
}
