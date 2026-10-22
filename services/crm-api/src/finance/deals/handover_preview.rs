//! `GET /finance/handovers/{id}/preview` (agreements design §17, amendments 9–11): what
//! a receiver, the chosen approver or the company's Admin reviews before deciding. Read by
//! request and company without locks; everyone else, and any unknown or decided request,
//! gets the same 404. The server shapes every field, so hidden ones never leave it.
use super::{
    gate::{self, Need},
    handover_evidence::fee,
    handover_preview_view as shape,
    handover_rows::{self, HandoverRow},
    handover_rules, row,
    views::Viewer,
};
use crate::{
    agreements::{handover, handover_terms::display_name},
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    records::{handover_facts, handover_listing},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// A member of this company (staff or its Admin) who may review this open request now.
fn may_review(row: &HandoverRow, user: &UserRow, workspace: &str) -> bool {
    user.workspace_id == workspace
        && matches!(user.role.as_str(), "staff" | "admin")
        && handover_rules::reviews(row, &Viewer::of(user))
}

/// The open request `id` of this company that `user` may review, or the shared 404.
pub async fn reviewable(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    id: Uuid,
    user: &UserRow,
) -> ApiResult<HandoverRow> {
    let sql = format!(
        "{} WHERE h.id=$1 AND h.workspace_id=$2",
        handover_rows::select()
    );
    let found = sqlx::query_as::<_, HandoverRow>(&sql)
        .bind(id)
        .bind(workspace)
        .fetch_optional(&mut **tx)
        .await?;
    found
        .filter(|row| may_review(row, user, workspace))
        .ok_or_else(ApiError::missing)
}

pub async fn preview(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    gate::reader(&state, &session, &workspace, Need::Module).await?;
    let id = gate::id(&id)?;
    let user = &session.user;
    let mut tx = state.pool.begin().await?;
    // One snapshot for every read, still without locks (security review L4).
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let request = reviewable(&mut tx, &workspace, id, user).await?;
    let deal = row::for_preview(&mut tx, &workspace, user.id, request.deal_id).await?;
    let members = (request.from_id, request.to_id);
    let terms = match request.agreement_id {
        Some(agreement) => Some(handover::offer_terms(&mut tx, agreement, members).await?),
        None => None,
    };
    let client = match &terms {
        Some(terms) => terms.client_name.clone(),
        None => {
            let name = handover_facts::client_name(&mut tx, &workspace, &deal.client_ref).await?;
            display_name(name.as_deref())
        }
    };
    let property = handover_listing::listing(&mut tx, &workspace, deal.property_ref.as_deref())
        .await?
        .map_or(Value::Null, |listing| {
            shape::property(&listing, listing.holder == Some(request.from_id))
        });
    let money = shape::deal(&mut tx, &workspace, &deal, &request).await?;
    let offer = shape::offer(terms.as_ref(), &request, fee(&deal)?);
    let ends = terms.as_ref().map(|terms| terms.expires_at.as_str());
    let view = request.view(&Viewer::of(user), ends);
    tx.commit().await?;
    Ok(Json(
        json!({"handover": view, "offer": offer, "deal": money,
        "client": {"name": client}, "property": property}),
    ))
}
