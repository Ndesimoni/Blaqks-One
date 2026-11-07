//! The deal's client and property follow a moved deal (agreements design §18): finance
//! says whether another live deal uses the property, and the assignments module moves or
//! shares the records in the same transaction.
use super::{handover_rows::HandoverRow, row::DealRow};
use crate::{
    assignments::follow::{self, Follow},
    error::ApiResult,
};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn follow(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    (request, deal): (&HandoverRow, &DealRow),
    actor: Uuid,
    referral: Option<i32>,
) -> ApiResult<Value> {
    let property_in_use = match deal.property_ref.as_deref() {
        Some(property) => {
            sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM crm_deals WHERE workspace_id=$1 \
                 AND property_ref=$2 AND id<>$3 AND earned_on IS NULL \
                 AND stage NOT IN ('Lost','Cancelled'))",
            )
            .bind(workspace)
            .bind(property)
            .bind(deal.id)
            .fetch_one(&mut **tx)
            .await?
        }
        None => false,
    };
    let records = Follow {
        workspace,
        actor,
        from: request.from_id,
        to: request.to_id,
        client_ref: &deal.client_ref,
        property_ref: deal.property_ref.as_deref(),
        property_in_use,
        deal_ref: &deal.legacy_id,
        referral_share_bp: referral,
    };
    follow::follow(tx, &records).await
}
