//! Earned snapshots and commission lines (finance-design §2.4): append-only; a revision
//! or unearn supersedes the current snapshot, which stays readable as history.
use super::{compute::Outcome, names, row::DealRow};
use crate::error::ApiResult;
use serde_json::Value;
use sqlx::{types::Json, FromRow, Postgres, Transaction};
use uuid::Uuid;

#[derive(Clone, Debug, FromRow)]
pub struct SnapshotRow {
    pub id: Uuid,
    pub deal_id: Uuid,
    pub revision: i32,
    pub earned_on: String,
    pub split_source: String,
    pub agreement_id: Option<Uuid>,
    pub primary_agent_id: Option<Uuid>,
    pub vat_registered: bool,
    pub gross_fils: i64,
    pub partner_fils: i64,
    pub net_fils: i64,
    pub company_fils: i64,
    pub vat_fils: i64,
    pub inputs: Json<Value>,
}

#[derive(Clone, Debug, FromRow)]
pub struct LineRow {
    pub snapshot_id: Uuid,
    pub role: String,
    pub agent_id: Uuid,
    pub agent_name: String,
    pub share_bp: i32,
    pub amount_fils: i64,
}

const COLUMNS: &str = "s.id,s.deal_id,s.revision,s.earned_on::text AS earned_on,s.split_source, \
    s.agreement_id,s.primary_agent_id,s.vat_registered,s.gross_fils,s.partner_fils,s.net_fils, \
    s.company_fils,s.vat_fils,s.inputs";

/// Current snapshots of `deals` in the workspace, with their lines.
pub async fn current(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deals: &[Uuid],
) -> ApiResult<(Vec<SnapshotRow>, Vec<LineRow>)> {
    let snapshots = sqlx::query_as::<_, SnapshotRow>(&format!(
        "SELECT {COLUMNS} FROM crm_deal_snapshots s WHERE s.workspace_id=$1 \
         AND s.deal_id=ANY($2) AND s.superseded_at IS NULL"
    ))
    .bind(workspace)
    .bind(deals)
    .fetch_all(&mut **transaction)
    .await?;
    let ids: Vec<Uuid> = snapshots.iter().map(|snapshot| snapshot.id).collect();
    let lines = sqlx::query_as::<_, LineRow>(
        "SELECT l.snapshot_id,l.role,l.agent_id,u.name AS agent_name,l.share_bp,l.amount_fils \
         FROM crm_deal_commission_lines l JOIN crm_users u ON u.id=l.agent_id \
         WHERE l.snapshot_id=ANY($1) ORDER BY l.role",
    )
    .bind(&ids)
    .fetch_all(&mut **transaction)
    .await?;
    Ok((snapshots, lines))
}

/// Inserts the next revision (`max(revision)+1`, §13 M-F4) and its lines. Returns the
/// revision number.
pub async fn insert(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    deal: &DealRow,
    earned_on: &str,
    outcome: &Outcome,
    actor: Uuid,
    reason: Option<&str>,
) -> ApiResult<i32> {
    let id = Uuid::new_v4();
    let calc = &outcome.calculation;
    let basis = &outcome.basis;
    let revision: i32 = sqlx::query_scalar(
        "INSERT INTO crm_deal_snapshots (id,deal_id,workspace_id,revision,earned_on,inputs, \
         split_source,agreement_id,primary_agent_id,vat_registered,vat_rate_bp,gross_fils, \
         partner_fils,net_fils,company_fils,vat_fils,reason,actor_id) \
         SELECT $1,$2,$3,COALESCE(max(revision),0)+1,$4::date,$5,$6,$7,$8,$9,500,$10,$11,$12, \
         $13,$14,$15,$16 FROM crm_deal_snapshots WHERE deal_id=$2 RETURNING revision",
    )
    .bind(id)
    .bind(deal.id)
    .bind(workspace)
    .bind(earned_on)
    .bind(Json(names::inputs(deal, outcome)))
    .bind(names::source_name(outcome.source))
    .bind(basis.agreement.map(|(agreement, _)| agreement))
    .bind(basis.primary)
    .bind(basis.vat_registered)
    .bind(calc.gross_fils)
    .bind(calc.partner_fils)
    .bind(calc.net_fils)
    .bind(calc.company_fils)
    .bind(calc.vat_fils)
    .bind(reason)
    .bind(actor)
    .fetch_one(&mut **transaction)
    .await?;
    let primary = basis.primary.zip(outcome.share_bp).zip(calc.primary_fils);
    let second = outcome.second.zip(calc.second_fils);
    let lines = [
        primary.map(|((agent, share), amount)| ("primary", agent, share, amount)),
        second.map(|((agent, share), amount)| ("second", agent, share, amount)),
    ];
    for (role, agent, share, amount) in lines.into_iter().flatten() {
        sqlx::query(
            "INSERT INTO crm_deal_commission_lines (snapshot_id,role,agent_id,share_bp,amount_fils) \
             VALUES ($1,$2,$3,$4,$5)",
        )
        .bind(id)
        .bind(role)
        .bind(agent)
        .bind(share)
        .bind(amount)
        .execute(&mut **transaction)
        .await?;
    }
    Ok(revision)
}

/// Supersedes the deal's current snapshot, returning it.
pub async fn supersede(
    transaction: &mut Transaction<'_, Postgres>,
    deal: Uuid,
    reason: &str,
) -> ApiResult<Option<SnapshotRow>> {
    Ok(sqlx::query_as::<_, SnapshotRow>(&format!(
        "UPDATE crm_deal_snapshots s SET superseded_at=clock_timestamp(),superseded_reason=$2 \
         WHERE s.deal_id=$1 AND s.superseded_at IS NULL RETURNING {COLUMNS}"
    ))
    .bind(deal)
    .bind(reason)
    .fetch_optional(&mut **transaction)
    .await?)
}
