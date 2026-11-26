//! Eligible same-company, assigned-only colleagues for one held record.
use super::{access, rules};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::extract::{rejection::QueryRejection, Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CandidateQuery {
    collection: String,
    record_id: String,
}

pub async fn candidates(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    query: Result<Query<CandidateQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    access::reader(&state, &session, &workspace).await?;
    let Query(query) = query.map_err(|_| ApiError::invalid("Provide a record type and ID."))?;
    let mut tx = state.pool.begin().await?;
    // The workspace lock first, like every writer, before the row locks below (review L3).
    workspaces::lock(&mut tx, &workspace).await?;
    let user = workspaces::member(&mut tx, &workspace, session.user.id).await?;
    let target = rules::shareable(
        &mut tx,
        &workspace,
        &user,
        (&query.collection, access::id(&query.record_id)?),
    )
    .await?;
    let members: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT id,name FROM crm_user_profiles WHERE workspace_id=$1 AND role='staff' \
         AND record_scope='assigned' AND active AND owner_active ORDER BY name,id",
    )
    .bind(&workspace)
    .fetch_all(&mut *tx)
    .await?;
    let mut colleagues = Vec::new();
    for (id, name) in members {
        if rules::receivable(
            &mut tx,
            &workspace,
            (&query.collection, target),
            (user.id, id),
        )
        .await?
        {
            colleagues.push(json!({"id":id,"name":name}));
        }
    }
    tx.commit().await?;
    Ok(Json(json!({"colleagues": colleagues})))
}
