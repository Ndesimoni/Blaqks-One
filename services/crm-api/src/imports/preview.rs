use super::{model::PreviewRequest, planning, snapshot};
use crate::{
    auth::{
        protection,
        session::{self, Session},
    },
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{self, ORGANISATION},
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub async fn preview(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<PreviewRequest>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    if session.user.role != "super-admin" {
        return Err(ApiError::forbidden());
    }
    workspaces::ensure_access(&state, &session, &workspace).await?;
    protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(request) =
        body.map_err(|_| ApiError::invalid("Provide a source workspace and record arrays."))?;
    let source = request.source_workspace_id.trim();
    if source.is_empty() || source.len() > 256 {
        return Err(ApiError::invalid(
            "A source workspace identifier is required.",
        ));
    }
    if (source == ORGANISATION) != (workspace == ORGANISATION) {
        return Err(ApiError::forbidden());
    }
    let normalized = request.records.normalize()?;
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, &workspace).await?;
    workspaces::ensure_writable(&mut transaction, &workspace, session.user.id, None).await?;
    let target = snapshot::read(&mut transaction, &workspace).await?;
    let fingerprint = snapshot::fingerprint(&target);
    let plan = planning::plan(normalized, &target)?;
    let token = session::random_token();
    let records = serde_json::to_value(plan.records)
        .map_err(|_| ApiError::invalid("Invalid import records."))?;
    sqlx::query("DELETE FROM crm_import_plans WHERE expires_at<=now()")
        .execute(&mut *transaction)
        .await?;
    let expires_at: String = sqlx::query_scalar(
        "INSERT INTO crm_import_plans (token_hash,actor_id,workspace_id,records,fingerprint,counts,skipped) \
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING \
         to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
    ).bind(session::digest(&token)).bind(session.user.id).bind(&workspace).bind(records)
        .bind(fingerprint).bind(json!(plan.counts)).bind(json!(plan.skipped))
        .fetch_one(&mut *transaction).await?;
    transaction.commit().await?;
    Ok(Json(
        json!({"token":token,"counts":plan.counts,"skipped":plan.skipped,"expiresAt":expires_at}),
    ))
}
