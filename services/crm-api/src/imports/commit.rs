use super::{
    insertion,
    model::{conflict, ImportRecords},
    snapshot,
};
use crate::{
    auth::{
        protection,
        session::{self, Session},
    },
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CommitRequest {
    token: String,
}

#[derive(FromRow)]
struct ImportPlan {
    records: Value,
    fingerprint: String,
    counts: Value,
    skipped: Value,
    result: Option<Value>,
    expired: bool,
}

pub async fn commit(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<CommitRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    if session.user.role != "super-admin" {
        return Err(ApiError::forbidden());
    }
    workspaces::ensure_access(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) = body.map_err(|_| ApiError::invalid("Provide an import preview token."))?;
    if request.token.len() != 43 {
        return Err(ApiError::invalid("Invalid import preview token."));
    }
    let token_hash = session::digest(&request.token);
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, &workspace).await?;
    workspaces::ensure_writable(&mut transaction, &workspace, session.user.id, None, None).await?;
    let plan = sqlx::query_as::<_, ImportPlan>(
        "SELECT records,fingerprint,counts,skipped,result,expires_at<=clock_timestamp() AS expired \
         FROM crm_import_plans WHERE token_hash=$1 AND actor_id=$2 AND workspace_id=$3 FOR UPDATE",
    )
    .bind(&token_hash)
    .bind(session.user.id)
    .bind(&workspace)
    .fetch_optional(&mut *transaction)
    .await?
    .ok_or_else(ApiError::forbidden)?;
    if plan.expired {
        return Err(ApiError::invalid(
            "This import preview expired. Preview the source again.",
        ));
    }
    if let Some(mut result) = plan.result {
        result["replayed"] = json!(true);
        transaction.commit().await?;
        return Ok(Json(result));
    }
    let target = snapshot::read(&mut transaction, &workspace).await?;
    if snapshot::fingerprint(&target) != plan.fingerprint {
        return Err(conflict());
    }
    let records: ImportRecords = serde_json::from_value(plan.records)
        .map_err(|_| ApiError::invalid("This import plan is invalid. Preview the source again."))?;
    insertion::insert(&mut transaction, &workspace, session.user.id, records).await?;
    let result = json!({"imported":plan.counts,"skipped":plan.skipped,"replayed":false});
    sqlx::query("UPDATE crm_import_plans SET result=$1,records='{}'::jsonb WHERE token_hash=$2")
        .bind(&result)
        .bind(token_hash)
        .execute(&mut *transaction)
        .await?;
    transaction.commit().await?;
    Ok(Json(result))
}
