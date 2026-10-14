//! `POST /finance/expenses {expense}` (finance-design §4, §6.2, owner Q6): finance Add;
//! staff record their own expenses, an Admin may name an active member with finance as
//! `incurredBy`. The expense starts pending with a server-issued `EX-` ID.
use super::{
    input::{self, INVALID},
    update::ensure_owner,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{
        access,
        deals::{
            gate::{self, Need},
            links,
        },
        entry::Kind,
        entry_view, entry_wire,
        events::{self, Action, Changes, Entity},
        wire,
    },
    records::{
        audit,
        ids::{self, FinanceIds},
    },
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    gate::writer(&state, &session, &headers, &workspace, Need::Create).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let body = wire::exact(body, &["expense"], INVALID)?;
    let manage = session.user.finance_access().manage;
    let expense = input::parse(&body["expense"], true, manage)?;
    let mut tx = state.pool.begin().await?;
    entry_wire::not_future(&expense.date_paid, &access::today(&mut tx).await?)?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Create).await?;
    let owner = expense.incurred_by.unwrap_or(live.id);
    ensure_owner(&mut tx, &workspace, &live, owner, None).await?;
    let property = expense.property_ref.as_deref();
    links::ensure_property(&mut tx, &workspace, &live, property, None).await?;
    let legacy = ids::issue_finance(&mut tx, &workspace, FinanceIds::Expenses).await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_expenses (id,workspace_id,legacy_id,incurred_by,date_paid,category, \
         supplier,campaign_reference,property_ref,amount_fils,receipt_url,notes,submitted_by, \
         last_edited_by) VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12,$13,$13)",
    )
    .bind(id)
    .bind(&workspace)
    .bind(&legacy)
    .bind(owner)
    .bind(&expense.date_paid)
    .bind(&expense.category)
    .bind(&expense.supplier)
    .bind(&expense.campaign_reference)
    .bind(&expense.property_ref)
    .bind(expense.amount_fils)
    .bind(&expense.receipt_url)
    .bind(&expense.notes)
    .bind(live.id)
    .execute(&mut *tx)
    .await?;
    let changes = Changes::default()
        .pair("expenseId", Value::Null, legacy)
        .pair("incurredBy", Value::Null, owner.to_string())
        .pair("datePaid", Value::Null, expense.date_paid.clone())
        .pair("amountFils", Value::Null, expense.amount_fils)
        .pair("propertyId", Value::Null, expense.property_ref.clone())
        .pair("status", Value::Null, "pending")
        .text("category", expense.category.is_some())
        .text("supplier", expense.supplier.is_some())
        .text("campaignReference", expense.campaign_reference.is_some())
        .text("receiptUrl", expense.receipt_url.is_some())
        .text("notes", expense.notes.is_some());
    let (ws, actor) = (workspace.as_str(), live.id);
    let submitted = Action::Submitted;
    events::append(
        &mut tx,
        ws,
        Entity::Expense,
        id,
        submitted,
        actor,
        changes,
        None,
    )
    .await?;
    audit::append(&mut tx, actor, ws, "created", "Expenses", id).await?;
    let entry = entry_view::entry(&mut tx, ws, &live, Kind::Expense, id).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "expense": entry }))))
}
