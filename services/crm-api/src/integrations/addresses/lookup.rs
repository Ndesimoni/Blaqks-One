//! The sending address of one member, for the Inbox's sender rule and the worker's
//! re-check right before each SendGrid send (E3b). Only an active address counts.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub struct Sending {
    pub local_part: String,
    pub display_name: String,
}

pub async fn active(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    domain: &str,
    member: Uuid,
) -> ApiResult<Option<Sending>> {
    let found: Option<(String, String)> = sqlx::query_as(
        "SELECT local_part,display_name FROM integrations.crm_sendgrid_addresses
         WHERE workspace_id=$1 AND domain=$2 AND member_id=$3 AND state='active'",
    )
    .bind(workspace)
    .bind(domain)
    .bind(member)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(found.map(|(local_part, display_name)| Sending {
        local_part,
        display_name,
    }))
}
