//! `GET /agreements/waiting` (design §17, H2 amendment 18): how many offers from other
//! companies wait for the caller's answer in this company, for the sidebar badge. An offer
//! waits for the participant who did not write its current revision, as on the screen, so
//! a counter-offer waits for the original sender. Counts only; the Super Admin is refused.
use super::access;
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};

pub async fn count(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure_reader(&state, &session, &workspace).await?;
    let answer: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM agreements.crm_agreements a
         JOIN agreements.crm_agreement_revisions v ON v.id=a.current_revision_id
         JOIN agreements.crm_agreement_participants p
             ON p.agreement_id=a.id AND p.party<>v.author_party
         WHERE a.state='sent' AND a.origin='direct' AND a.archived_at IS NULL
         AND a.workspace_id<>a.recipient_workspace_id AND a.expires_at>clock_timestamp()
         AND p.member_id=$1 AND p.workspace_id=$2",
    )
    .bind(session.user.id)
    .bind(&workspace)
    .fetch_one(&state.pool)
    .await?;
    Ok(Json(json!({ "answer": answer })))
}
