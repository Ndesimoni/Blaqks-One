//! `PATCH /finance/expenses/{id} {expense, version, reason?}` (finance-design §4, §13 M-F6,
//! L-F1, L-F5): the shared edit states; only an Admin changes who incurred an expense, and
//! receipt links are recorded in history only as "changed".
use super::{
    input::{self, INVALID},
    row,
};
use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    finance::{
        access,
        deals::{
            gate::{self, Need},
            links,
        },
        entry::{Kind, STALE},
        entry_edit::{self, Edit},
        entry_view, entry_wire,
        errors::INELIGIBLE,
        events::Changes,
    },
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// L-F1: a newly named owner is the caller or an active member with finance.
pub async fn ensure_owner(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    owner: Uuid,
    stored: Option<Uuid>,
) -> ApiResult<()> {
    if Some(owner) == stored || (owner == live.id && live.workspace_id == workspace) {
        return Ok(());
    }
    match links::finance_member(tx, workspace, owner, false).await? {
        true => Ok(()),
        false => Err(ApiError::invalid(INELIGIBLE)),
    }
}

pub async fn update(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace, Need::Edit).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let (expense, version, reason) = entry_edit::envelope(body, Kind::Expense, INVALID)?;
    let input = input::parse(&expense, false, session.user.finance_access().manage)?;
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let today = access::today(&mut tx).await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Edit).await?;
    let stored = row::locked(&mut tx, &workspace, &live, id).await?;
    if stored.state.version != version {
        return Err(ApiError::stale(STALE));
    }
    let edit = entry_edit::mode(&mut tx, &stored.state, &live, reason.as_deref()).await?;
    if input.date_paid != stored.date_paid {
        entry_wire::not_future(&input.date_paid, &today)?;
    }
    let owner = input.incurred_by.unwrap_or(stored.incurred_by);
    ensure_owner(&mut tx, &workspace, &live, owner, Some(stored.incurred_by)).await?;
    let (property, previous) = (
        input.property_ref.as_deref(),
        stored.property_ref.as_deref(),
    );
    links::ensure_property(&mut tx, &workspace, &live, property, previous).await?;
    let changes = Changes::default()
        .pair(
            "incurredBy",
            stored.incurred_by.to_string(),
            owner.to_string(),
        )
        .pair(
            "datePaid",
            stored.date_paid.clone(),
            input.date_paid.clone(),
        )
        .pair("amountFils", stored.state.amount_fils, input.amount_fils)
        .pair(
            "propertyId",
            stored.property_ref.clone(),
            input.property_ref.clone(),
        )
        .text("category", stored.category != input.category)
        .text("supplier", stored.supplier != input.supplier)
        .text(
            "campaignReference",
            stored.campaign_reference != input.campaign_reference,
        )
        .text("receiptUrl", stored.receipt_url != input.receipt_url)
        .text("notes", stored.state.notes != input.notes);
    if changes.is_empty() && edit != Edit::Resubmit {
        let entry = entry_view::entry(&mut tx, &workspace, &live, Kind::Expense, id).await?;
        tx.commit().await?;
        return Ok(Json(json!({ "expense": entry })));
    }
    sqlx::query(&format!(
        "UPDATE crm_expenses SET incurred_by=$2,date_paid=$3::date,category=$4,supplier=$5, \
         campaign_reference=$6,property_ref=$7,amount_fils=$8,receipt_url=$9,notes=$10, \
         last_edited_by=$11,version=version+1,updated_at=now(){} WHERE id=$1",
        edit.status_sql()
    ))
    .bind(id)
    .bind(owner)
    .bind(&input.date_paid)
    .bind(&input.category)
    .bind(&input.supplier)
    .bind(&input.campaign_reference)
    .bind(&input.property_ref)
    .bind(input.amount_fils)
    .bind(&input.receipt_url)
    .bind(&input.notes)
    .bind(live.id)
    .execute(&mut *tx)
    .await?;
    let (ws, kind, state) = (workspace.as_str(), Kind::Expense, &stored.state);
    let reason = reason.as_deref();
    entry_edit::record(&mut tx, ws, kind, state, edit, &live, changes, reason).await?;
    let entry = entry_view::entry(&mut tx, ws, &live, kind, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ "expense": entry })))
}
