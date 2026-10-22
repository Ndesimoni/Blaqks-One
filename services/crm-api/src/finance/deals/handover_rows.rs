//! Hand-over requests as rows and views (finance-design §13 H-F1). A receiver sees the
//! deal's ID, type, stage and earned state — never its money — before accepting.
use super::views::Viewer;
use crate::error::ApiResult;
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

pub const NOT_PENDING: &str = "This hand-over is no longer pending.";
pub const HAS_SECOND: &str =
    "This deal already has a second agent. Ask your Admin to change the split.";
pub const CAP: &str = "The referral share is above your team's limit.";

#[derive(Clone, Debug, FromRow)]
pub struct HandoverRow {
    pub id: Uuid,
    pub deal_id: Uuid,
    pub deal_ref: String,
    pub deal_type: String,
    pub stage: String,
    pub earned: bool,
    pub from_id: Uuid,
    pub from_name: String,
    pub to_id: Uuid,
    pub to_name: String,
    pub referral_share_bp: Option<i32>,
    pub status: String,
    pub requested_by: Uuid,
    pub created_at: String,
    /// The agreement recording this offer (agreements design §14); none for older ones.
    pub agreement_id: Option<Uuid>,
}

pub const SELECT: &str = "SELECT h.id,h.deal_id,d.legacy_id AS deal_ref,d.deal_type,d.stage, \
    d.earned_on IS NOT NULL AS earned,h.from_id,f.name AS from_name,h.to_id,t.name AS to_name, \
    h.referral_share_bp,h.status,h.requested_by,h.agreement_id, \
    to_char(h.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS created_at \
    FROM crm_deal_handovers h JOIN crm_deals d ON d.id=h.deal_id \
    JOIN crm_users f ON f.id=h.from_id JOIN crm_users t ON t.id=h.to_id";

impl HandoverRow {
    pub fn view(&self, viewer: &Viewer) -> Value {
        let manage = viewer.access.manage;
        let allowed = json!({"accept": self.to_id == viewer.id,
            "decline": self.to_id == viewer.id || manage,
            "cancel": self.requested_by == viewer.id || manage, "approve": manage});
        json!({"id": self.id, "dealId": self.deal_ref, "dealType": self.deal_type,
            "stage": self.stage, "earned": self.earned,
            "from": {"id": self.from_id, "name": self.from_name},
            "to": {"id": self.to_id, "name": self.to_name},
            "referralShareBp": self.referral_share_bp, "status": self.status,
            "createdAt": self.created_at, "agreementId": self.agreement_id,
            "allowed": allowed})
    }
}

pub async fn find(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<HandoverRow> {
    Ok(
        sqlx::query_as::<_, HandoverRow>(&format!("{SELECT} WHERE h.id=$1"))
            .bind(id)
            .fetch_one(&mut **tx)
            .await?,
    )
}

/// Pending requests the viewer takes part in (all of them for team finance).
pub async fn pending(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    viewer: &Viewer,
) -> ApiResult<Vec<Value>> {
    let rows = sqlx::query_as::<_, HandoverRow>(&format!(
        "{SELECT} WHERE h.workspace_id=$1 AND h.status='pending' \
         AND ($2::uuid IS NULL OR h.from_id=$2 OR h.to_id=$2) ORDER BY h.created_at,h.id"
    ))
    .bind(workspace)
    .bind((!viewer.team).then_some(viewer.id))
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.iter().map(|row| row.view(viewer)).collect())
}

/// The team's referral cap (0 before settings exist).
pub async fn cap(tx: &mut Transaction<'_, Postgres>, workspace: &str) -> ApiResult<i32> {
    let cap: Option<i32> = sqlx::query_scalar(
        "SELECT max_referral_share_bp FROM crm_finance_settings WHERE workspace_id=$1 FOR SHARE",
    )
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(cap.unwrap_or(0))
}
