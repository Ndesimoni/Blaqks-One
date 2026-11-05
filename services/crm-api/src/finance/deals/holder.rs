//! Changing a deal's holder (§5.4, §13 H-F1): one version step, `crm_assignments`
//! history ('Deals'), an `assigned` finance event (from, to, actor, reason) and an
//! `assigned` activity entry. Open hand-overs of the deal are cancelled. Lines of an
//! earned deal never change; a referral is only added to unearned deals.
use super::row::DealRow;
use crate::{
    agreements::handover,
    error::ApiResult,
    finance::events::{self, Action, Changes, Entity},
    records::{
        audit,
        history::{self, Change},
    },
};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub struct Move<'a> {
    pub workspace: &'a str,
    pub deal: &'a DealRow,
    pub to: Option<Uuid>,
    pub actor: Uuid,
    /// `crm_assignments.reason`: `reassigned` or `handover`.
    pub history: &'static str,
    /// The finance event reason shown in history.
    pub reason: &'a str,
    /// The previous holder keeps this share as a referral line (unearned deals only).
    pub referral: Option<i32>,
    /// Who asked for a hand-over, when someone other than the actor did.
    pub requested_by: Option<Uuid>,
}

pub async fn apply(tx: &mut Transaction<'_, Postgres>, change: Move<'_>) -> ApiResult<()> {
    let deal = change.deal;
    let referral = change.referral.zip(deal.assignee_id);
    sqlx::query(
        "UPDATE crm_deals SET assignee_id=$2,version=version+1,updated_at=now(), \
         second_agent_id=CASE WHEN $3::uuid IS NULL THEN second_agent_id ELSE $3 END, \
         second_agent_share_bp=CASE WHEN $3::uuid IS NULL THEN second_agent_share_bp ELSE $4 END, \
         second_agent_kind=CASE WHEN $3::uuid IS NULL THEN second_agent_kind ELSE 'referral' END \
         WHERE id=$1",
    )
    .bind(deal.id)
    .bind(change.to)
    .bind(referral.map(|(_, from)| from))
    .bind(referral.map(|(share, _)| share))
    .execute(&mut **tx)
    .await?;
    let withdrawn: Vec<Option<Uuid>> = sqlx::query_scalar(
        "UPDATE crm_deal_handovers SET status='cancelled',decided_by=$2,decided_at=now() \
         WHERE deal_id=$1 AND status IN ('pending','awaiting_approval') \
         RETURNING agreement_id",
    )
    .bind(deal.id)
    .bind(change.actor)
    .fetch_all(&mut **tx)
    .await?;
    let withdrawn: Vec<Uuid> = withdrawn.into_iter().flatten().collect();
    handover::withdraw_all(tx, &withdrawn, change.actor).await?;
    let record = Change {
        workspace: change.workspace,
        record: deal.id,
        collection: "Deals",
        from: deal.assignee_id,
        to: change.to,
        actor: change.actor,
        reason: change.history,
    };
    history::append(tx, &record).await?;
    let text = |id: Option<Uuid>| id.map_or(Value::Null, |id| Value::String(id.to_string()));
    let mut changes = Changes::default()
        .pair("assignee", text(deal.assignee_id), text(change.to))
        .pair("requestedBy", Value::Null, text(change.requested_by));
    if let Some((share, from)) = referral {
        changes = changes
            .pair(
                "secondAgentId",
                text(deal.second_agent_id),
                text(Some(from)),
            )
            .pair("secondAgentShareBp", deal.second_agent_share_bp, share);
    }
    events::append(
        tx,
        change.workspace,
        Entity::Deal,
        deal.id,
        Action::Assigned,
        change.actor,
        changes,
        Some(change.reason),
    )
    .await?;
    audit::append(
        tx,
        change.actor,
        change.workspace,
        "assigned",
        "Deals",
        deal.id,
    )
    .await
}
