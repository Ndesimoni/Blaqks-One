use crate::{
    auth::{accounts, protection, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{self, company},
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    headers: HeaderMap,
    body: Result<Json<company::SeatLimitRequest>, JsonRejection>,
) -> ApiResult<Json<company::SeatUsage>> {
    protection::mutation(&state, &headers, &session.csrf_token)?;
    if session.user.role != "super-admin" || workspace == workspaces::ORGANISATION {
        return Err(ApiError::forbidden());
    }
    let Json(request) = body.map_err(|_| ApiError::invalid("Provide a valid seat limit."))?;
    if !(1..=10_000).contains(&request.member_limit) || request.version < 1 {
        return Err(ApiError::invalid("Provide a valid seat limit."));
    }
    let mut transaction = state.pool.begin().await?;
    workspaces::lock(&mut transaction, &workspace).await?;
    workspaces::ensure_writable(&mut transaction, &workspace, session.user.id, None, None).await?;
    // A suspended company keeps its seats as they are. The owner row lock serialises with
    // a suspension, which takes the Super Admin's workspace lock, not this one.
    let company_owner = workspaces::owner_of(&mut transaction, &workspace).await?;
    accounts::lock_active_admin(&mut transaction, company_owner).await?;
    let current = company::get(&mut *transaction, &workspace).await?;
    if current.version != request.version {
        return Err(ApiError::conflict(
            "The company changed. Reload and try again.",
        ));
    }
    let used = super::seats::occupied(&mut transaction, &workspace, None).await?;
    if i64::from(request.member_limit) < used {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "The seat limit cannot be lower than the seats currently in use.",
            "seat_limit_too_low",
        ));
    }
    let from = current.member_limit.ok_or_else(ApiError::forbidden)?;
    if from != request.member_limit {
        company::set_member_limit(
            &mut transaction,
            &workspace,
            session.user.id,
            from,
            request.member_limit,
        )
        .await?;
    }
    let saved = company::get(&mut *transaction, &workspace).await?;
    transaction.commit().await?;
    Ok(Json(company::SeatUsage {
        used,
        limit: saved.member_limit.ok_or_else(ApiError::forbidden)?,
        version: saved.version,
    }))
}
