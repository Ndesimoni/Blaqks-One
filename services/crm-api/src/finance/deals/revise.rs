//! `POST /finance/deals/{id}/revise` (Admin, finance-design §2.4, §13 M-F3, M-F4): a
//! reason, optional split changes; supersedes the current snapshot with revision
//! `max+1` and returns the before and after figures.
use super::{
    compute,
    figures::Figures,
    gate::{self, Need, STALE},
    links, list, revise_input, row, snapshot,
    views::{self, Viewer},
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::{
        admin,
        errors::INELIGIBLE,
        events::{self, Action, Changes, Entity},
    },
    records::audit,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

pub const NOT_EARNED: &str = "Only earned deals can be revised or unearned.";
pub const VOID_FIRST: &str = "Void approved payments first.";

pub async fn revise(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path((workspace, id)): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace, Need::Manage).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(revise_input::INVALID))?;
    let request = revise_input::parse(body)?;
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, Need::Manage).await?;
    let mut deal = row::locked(&mut tx, &workspace, &live, id).await?;
    if deal.version != request.version {
        return Err(ApiError::stale(STALE));
    }
    let (snapshots, lines) = snapshot::current(&mut tx, &workspace, &[deal.id]).await?;
    let previous = snapshots.into_iter().next().filter(|_| deal.earned());
    let previous = previous.ok_or(ApiError::conflict(NOT_EARNED))?;
    let basis = revise_input::basis(&mut tx, &workspace, &previous, &request).await?;
    if let Some(Some((agent, _))) = request.second {
        let new = Some(agent) != deal.second_agent_id;
        if Some(agent) == basis.primary
            || (new && !links::finance_member(&mut tx, &workspace, agent, true).await?)
        {
            return Err(ApiError::invalid(INELIGIBLE));
        }
    }
    admin::admin_path(&mut tx, &live).await?;
    if let Some(wanted) = request.second {
        let current = deal.second_agent_id.zip(deal.second_agent_share_bp);
        if wanted != current {
            deal.second_agent_kind = wanted.map(|_| "split".into());
        }
        deal.second_agent_id = wanted.map(|(agent, _)| agent);
        deal.second_agent_share_bp = wanted.map(|(_, share)| share);
    }
    if let Some(wanted) = request
        .override_bp
        .filter(|bp| *bp != deal.override_agent_share_bp)
    {
        deal.override_agent_share_bp = wanted;
        deal.override_reason = wanted.map(|_| request.reason.clone());
    }
    let outcome = compute::compute(&deal, basis)?;
    if outcome.calculation.net_fils < deal.approved_fils {
        return Err(ApiError::conflict(VOID_FIRST));
    }
    sqlx::query(
        "UPDATE crm_deals SET second_agent_id=$2,second_agent_share_bp=$3,second_agent_kind=$4, \
         override_agent_share_bp=$5,override_reason=$6,version=version+1,updated_at=now() \
         WHERE id=$1",
    )
    .bind(deal.id)
    .bind(deal.second_agent_id)
    .bind(deal.second_agent_share_bp)
    .bind(&deal.second_agent_kind)
    .bind(deal.override_agent_share_bp)
    .bind(&deal.override_reason)
    .execute(&mut *tx)
    .await?;
    let reason = request.reason.as_str();
    snapshot::supersede(&mut tx, deal.id, reason).await?;
    let (actor, earned_on) = (live.id, previous.earned_on.clone());
    let revision = snapshot::insert(
        &mut tx,
        &workspace,
        &deal,
        &earned_on,
        &outcome,
        actor,
        Some(reason),
    )
    .await?;
    let before = Figures::from_snapshot(&previous, &lines);
    let (after, after_lines) = snapshot::current(&mut tx, &workspace, &[deal.id]).await?;
    let after = Figures::from_snapshot(&after[0], &after_lines);
    let text = |id: Option<uuid::Uuid>| id.map(|id| id.to_string());
    let changes = Changes::default()
        .pair("revision", previous.revision, revision)
        .pair(
            "primaryAgentId",
            text(before.primary_agent),
            text(after.primary_agent),
        )
        .pair(
            "agreementId",
            text(before.agreement_id),
            text(after.agreement_id),
        )
        .pair("splitSource", before.source.clone(), after.source.clone())
        .pair("netFils", before.net_fils, after.net_fils)
        .pair("companyFils", before.company_fils, after.company_fils);
    let ws = workspace.as_str();
    let action = Action::Revised;
    events::append(
        &mut tx,
        ws,
        Entity::Deal,
        deal.id,
        action,
        actor,
        changes,
        Some(reason),
    )
    .await?;
    audit::append(&mut tx, actor, ws, "revised", "Deals", deal.id).await?;
    let entry = list::entry(&mut tx, &workspace, &live, id).await?;
    tx.commit().await?;
    let viewer = Viewer::of(&live);
    let (before, after) = (
        views::calculation(&before, &viewer),
        views::calculation(&after, &viewer),
    );
    Ok(Json(
        json!({"deal": entry, "before": before, "after": after}),
    ))
}
