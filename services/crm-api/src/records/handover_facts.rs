//! The only client and property facts an in-company hand-over agreement may copy from a
//! deal (agreements design §6, §14): the client's stored name, which the agreement cuts
//! to a first name and last initial, and six property facts. No contact details, notes,
//! owner or record IDs leave this module. Both records are the deal's own links, already
//! checked to be in the same workspace.
use crate::error::ApiResult;
use sqlx::{FromRow, Postgres, Transaction};

/// Property facts as stored on the record; any of them may be missing.
#[derive(Clone, Debug, Default, FromRow)]
pub struct PropertyFacts {
    pub emirate: Option<String>,
    pub community: Option<String>,
    pub property_type: Option<String>,
    pub bedrooms: Option<String>,
    pub size_sqft: Option<String>,
    pub price_aed: Option<String>,
}

/// The client's stored name and the property's facts (none without a property).
pub async fn handover(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    client_ref: &str,
    property_ref: Option<&str>,
) -> ApiResult<(Option<String>, Option<PropertyFacts>)> {
    let name: Option<Option<String>> = sqlx::query_scalar(
        "SELECT payload->>'full_name' FROM crm_records \
         WHERE workspace_id=$1 AND collection='Clients' AND legacy_id=$2",
    )
    .bind(workspace)
    .bind(client_ref)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(property_ref) = property_ref else {
        return Ok((name.flatten(), None));
    };
    let facts: Option<PropertyFacts> = sqlx::query_as(
        "SELECT payload->>'emirate' AS emirate, payload->>'community' AS community, \
         payload->>'property_type' AS property_type, payload->>'bedrooms' AS bedrooms, \
         payload->>'area_sq_ft' AS size_sqft, payload->>'price_annual_rent_aed' AS price_aed \
         FROM crm_records WHERE workspace_id=$1 AND collection='Properties' AND legacy_id=$2",
    )
    .bind(workspace)
    .bind(property_ref)
    .fetch_optional(&mut **tx)
    .await?;
    Ok((name.flatten(), facts))
}

/// The client's stored name, for an older hand-over without an agreement.
pub async fn client_name(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    client_ref: &str,
) -> ApiResult<Option<String>> {
    Ok(handover(tx, workspace, client_ref, None).await?.0)
}
