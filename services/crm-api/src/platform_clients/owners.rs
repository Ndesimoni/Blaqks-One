//! Who a client can be assigned to: the Owner and the live Blaqks One team members who hold
//! the clients area at Manage, by the same rule the guard applies (`areas::allows`).
//! `GET /api/crm/platform/clients/owners` lists them for the assign picker.
use super::guard;
use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{
        platform::{areas, Area, Level},
        ORGANISATION,
    },
};
use axum::{extract::State, Json};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const OWNER: &str = "Assign the client to someone on the Blaqks One team who works on clients.";

/// Everyone who may hold clients, by name.
pub(super) async fn eligible(tx: &mut Transaction<'_, Postgres>) -> ApiResult<Vec<UserRow>> {
    let people = sqlx::query_as::<_, UserRow>(
        "SELECT * FROM crm_user_profiles WHERE workspace_id=$1 AND active AND owner_active \
         AND role IN ('super-admin','platform') ORDER BY name,id",
    )
    .bind(ORGANISATION)
    .fetch_all(&mut **tx)
    .await?;
    Ok(people
        .into_iter()
        .filter(|person| areas::allows(person, Area::Clients, Level::Manage))
        .collect())
}

/// The name of a person a client may be assigned to, or 400.
pub(super) async fn check(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<String> {
    eligible(tx)
        .await?
        .into_iter()
        .find(|person| person.id == id)
        .map(|person| person.name)
        .ok_or(ApiError::invalid(OWNER))
}

pub async fn owners(State(state): State<AppState>, session: Session) -> ApiResult<Json<Value>> {
    let (mut tx, _) = guard::read(&state, &session).await?;
    let owners: Vec<Value> = eligible(&mut tx)
        .await?
        .into_iter()
        .map(|person| json!({"id": person.id, "name": person.name}))
        .collect();
    tx.commit().await?;
    Ok(Json(json!({ "owners": owners })))
}
