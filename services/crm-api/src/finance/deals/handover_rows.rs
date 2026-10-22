//! Hand-over requests as rows and views (finance-design §13 H-F1, agreements design §17).
//! A receiver sees the deal's ID, type, stage and earned state here — never its money; the
//! reviewed offer comes from the preview.
use super::{handover_rules, views::Viewer};
use crate::{agreements::handover, error::ApiResult};
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

pub use super::handover_checks::cap;

pub const NOT_PENDING: &str = "This hand-over is no longer pending.";
pub const HAS_SECOND: &str =
    "This deal already has a second agent. Ask your Admin to change the split.";
pub const CAP: &str = "The referral share is above your team's limit.";
/// Open requests (H2 amendment 1): waiting for the receiver or for the approver.
pub const OPEN: &str = "('pending','awaiting_approval')";

#[derive(Clone, Debug, FromRow)]
pub struct HandoverRow {
    pub id: Uuid,
    pub workspace_id: String,
    pub deal_id: Uuid,
    pub deal_ref: String,
    pub deal_type: String,
    pub stage: String,
    pub earned: bool,
    pub from_id: Uuid,
    pub from_name: String,
    pub to_id: Uuid,
    pub to_name: String,
    /// The receiver is the company's Admin (a full hand-over without approval).
    pub to_admin: bool,
    pub referral_share_bp: Option<i32>,
    pub status: String,
    pub requested_by: Uuid,
    pub created_at: String,
    /// The agreement recording this offer (agreements design §14); none for older ones.
    pub agreement_id: Option<Uuid>,
    pub requires_approval: bool,
    pub approver_id: Option<Uuid>,
    pub approver_name: Option<String>,
    pub accepted_at: Option<String>,
}

const STAMP: &str = "'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'";

pub fn select() -> String {
    format!(
        "SELECT h.id,h.workspace_id,h.deal_id,d.legacy_id AS deal_ref,d.deal_type,d.stage, \
         d.earned_on IS NOT NULL AS earned,h.from_id,f.name AS from_name,h.to_id, \
         t.name AS to_name,t.role='admin' AS to_admin,h.referral_share_bp,h.status, \
         h.requested_by,h.agreement_id,h.requires_approval,h.approver_id, \
         ap.name AS approver_name, \
         to_char(h.created_at AT TIME ZONE 'UTC',{STAMP}) AS created_at, \
         to_char(h.accepted_at AT TIME ZONE 'UTC',{STAMP}) AS accepted_at \
         FROM crm_deal_handovers h JOIN crm_deals d ON d.id=h.deal_id \
         JOIN crm_users f ON f.id=h.from_id JOIN crm_users t ON t.id=h.to_id \
         LEFT JOIN crm_users ap ON ap.id=h.approver_id"
    )
}

impl HandoverRow {
    pub fn open(&self) -> bool {
        matches!(self.status.as_str(), "pending" | "awaiting_approval")
    }

    /// The view for `viewer`; `expires_at` is the offer's end from its agreement.
    pub fn view(&self, viewer: &Viewer, expires_at: Option<&str>) -> Value {
        let approval = self.approver_id.map_or(Value::Null, |id| {
            json!({"approver": {"id": id, "name": self.approver_name},
                "acceptedAt": self.accepted_at})
        });
        json!({"id": self.id, "dealId": self.deal_ref, "dealType": self.deal_type,
            "stage": self.stage, "earned": self.earned,
            "from": {"id": self.from_id, "name": self.from_name},
            "to": {"id": self.to_id, "name": self.to_name}, "toAdmin": self.to_admin,
            "referralShareBp": self.referral_share_bp, "status": self.status,
            "createdAt": self.created_at, "agreementId": self.agreement_id,
            "approval": approval, "expiresAt": expires_at,
            "allowed": handover_rules::allowed(self, viewer)})
    }
}

pub async fn find(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<HandoverRow> {
    Ok(
        sqlx::query_as::<_, HandoverRow>(&format!("{} WHERE h.id=$1", select()))
            .bind(id)
            .fetch_one(&mut **tx)
            .await?,
    )
}

/// The offer ends of `rows` that carry an agreement.
pub async fn deadlines(
    tx: &mut Transaction<'_, Postgres>,
    rows: &[&HandoverRow],
) -> ApiResult<HashMap<Uuid, (String, bool)>> {
    let ids: Vec<Uuid> = rows.iter().filter_map(|row| row.agreement_id).collect();
    if ids.is_empty() {
        return Ok(HashMap::new());
    }
    let found = handover::deadlines(tx, &ids).await?;
    Ok(found
        .into_iter()
        .map(|(id, at, expired)| (id, (at, expired)))
        .collect())
}

/// One request's view with its offer end.
pub async fn shown(
    tx: &mut Transaction<'_, Postgres>,
    id: Uuid,
    viewer: &Viewer,
) -> ApiResult<Value> {
    let row = find(tx, id).await?;
    let ends = deadlines(tx, &[&row]).await?;
    let end = row.agreement_id.and_then(|id| ends.get(&id));
    Ok(row.view(viewer, end.map(|(at, _)| at.as_str())))
}

/// Open requests the viewer takes part in (all of them for team finance).
pub async fn open(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    viewer: &Viewer,
) -> ApiResult<Vec<Value>> {
    let rows = sqlx::query_as::<_, HandoverRow>(&format!(
        "{} WHERE h.workspace_id=$1 AND h.status IN {OPEN} \
         AND ($2::uuid IS NULL OR h.from_id=$2 OR h.to_id=$2) ORDER BY h.created_at,h.id",
        select()
    ))
    .bind(workspace)
    .bind((!viewer.team).then_some(viewer.id))
    .fetch_all(&mut **tx)
    .await?;
    let ends = deadlines(tx, &rows.iter().collect::<Vec<_>>()).await?;
    let end = |row: &HandoverRow| row.agreement_id.and_then(|id| ends.get(&id));
    Ok(rows
        .iter()
        .map(|row| row.view(viewer, end(row).map(|(at, _)| at.as_str())))
        .collect())
}
