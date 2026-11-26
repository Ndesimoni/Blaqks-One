//! The deal behind an in-company hand-over agreement (H3b, owner 2026-10-23), for the
//! agreement's detail: its deal, client and listing IDs in the caller's own company, so the
//! screen can show the client and the listing from the caller's own records. Agreements
//! calls this; it never reads finance tables.
use crate::error::ApiResult;
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// `{dealId, clientId, propertyId}` of the hand-over that `agreement` records, if any.
pub async fn of_agreement(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    agreement: Uuid,
) -> ApiResult<Option<Value>> {
    let found: Option<(String, String, Option<String>)> = sqlx::query_as(
        "SELECT d.legacy_id,d.client_ref,d.property_ref FROM crm_deal_handovers h \
         JOIN crm_deals d ON d.id=h.deal_id AND d.workspace_id=h.workspace_id \
         WHERE h.agreement_id=$1 AND h.workspace_id=$2",
    )
    .bind(agreement)
    .bind(workspace)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(found.map(|(deal, client, property)| {
        json!({"dealId": deal, "clientId": client, "propertyId": property})
    }))
}
