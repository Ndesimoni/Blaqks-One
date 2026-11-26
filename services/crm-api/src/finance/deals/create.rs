//! `POST /finance/deals` (finance-design §6.2, §13 M-F1): finance Add; staff create on
//! clients they hold and hold the deal; Admin-created deals go to the client's holder.
use super::{
    gate::{self, Need},
    input::{self, DealInput, INVALID},
    links, list,
    terms::terms,
};
use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    finance::{
        events::{self, Action, Entity},
        ids::{self, FinanceIds},
        wire,
    },
    records::{
        audit,
        history::{self, Change},
    },
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
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
    let body = wire::exact(body, &["deal"], INVALID)?;
    let deal = input::parse(&body["deal"], true)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Create).await?;
    let legacy = ids::issue(&mut tx, &workspace, FinanceIds::Deals).await?;
    let id = insert(&mut tx, &workspace, &live, &deal, &legacy).await?;
    let entry = list::entry(&mut tx, &workspace, &live, id).await?;
    tx.commit().await?;
    Ok((StatusCode::CREATED, Json(json!({ "deal": entry }))))
}

/// Steps 5–10 under the workspace lock with the live creator: links, the initial holder,
/// the row, a `created` event, activity and assignment history. `legacy` is the issued
/// ID (the local sample-data command passes its own `-S` IDs).
pub async fn insert(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    deal: &DealInput,
    legacy: &str,
) -> ApiResult<Uuid> {
    links::ensure_client(tx, workspace, live, &deal.client_ref, None).await?;
    let property = deal.property_ref.as_deref();
    links::ensure_property(tx, workspace, live, property, None).await?;
    let holder = links::initial_holder(tx, workspace, live, &deal.client_ref).await?;
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO crm_deals (id,workspace_id,legacy_id,assignee_id,client_ref,property_ref, \
         deal_type,stage,agreed_value_fils,fee_basis,fee_rate_bp,fixed_fee_fils,partner_share_bp, \
         partner_name,details,created_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
    )
    .bind(id)
    .bind(workspace)
    .bind(legacy)
    .bind(holder)
    .bind(&deal.client_ref)
    .bind(&deal.property_ref)
    .bind(deal.deal_type)
    .bind(deal.stage)
    .bind(deal.agreed_value_fils)
    .bind(deal.fee_basis)
    .bind(deal.fee_rate_bp)
    .bind(deal.fixed_fee_fils)
    .bind(deal.partner_share_bp)
    .bind(&deal.partner_name)
    .bind(sqlx::types::Json(&deal.details))
    .bind(live.id)
    .execute(&mut **tx)
    .await?;
    let changes = terms(None, deal).pair("dealId", Value::Null, legacy);
    let (actor, entity, action) = (live.id, Entity::Deal, Action::Created);
    events::append(tx, workspace, entity, id, action, actor, changes, None).await?;
    audit::append(tx, actor, workspace, "created", "Deals", id).await?;
    if holder.is_some() {
        let change = Change {
            workspace,
            record: id,
            collection: "Deals",
            from: None,
            to: holder,
            actor,
            reason: "created",
        };
        history::append(tx, &change).await?;
    }
    Ok(id)
}
