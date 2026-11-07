//! Explicit public publication boundary. Private location is used only for opaque identity.
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use serde_json::Value;
use sha2::{Digest, Sha256};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub struct Source {
    pub version: i64,
    pub physical_key: String,
    pub listing: Value,
    pub area: Value,
    pub media: Vec<Uuid>,
}
pub async fn read(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: &UserRow,
    agent: &UserRow,
    record: Uuid,
    version: i64,
) -> ApiResult<Source> {
    for user in [actor, agent] {
        if super::lookup::visible(tx, workspace, user, "Properties", &[record])
            .await?
            .is_empty()
        {
            return Err(ApiError::missing());
        }
    }
    let (payload,actual):(Value,i64)=sqlx::query_as("SELECT payload,version FROM crm_records WHERE workspace_id=$1 AND collection='Properties' AND id=$2 FOR SHARE")
        .bind(workspace).bind(record).fetch_optional(&mut **tx).await?.ok_or_else(ApiError::missing)?;
    if actual != version {
        return Err(ApiError::stale(
            "The property has changed. Reload it before publishing.",
        ));
    }
    if closed(&payload) {
        return Err(ApiError::conflict("This property is no longer available."));
    }
    let mut source = super::publication_source_fields::project(&payload)?;
    source.version = actual;
    Ok(source)
}
pub async fn eligible(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    record: Uuid,
    agent: &UserRow,
) -> ApiResult<bool> {
    if agent.workspace_id != workspace
        || super::lookup::visible(tx, workspace, agent, "Properties", &[record])
            .await?
            .is_empty()
    {
        return Ok(false);
    }
    let payload:Option<Value>=sqlx::query_scalar("SELECT payload FROM crm_records WHERE workspace_id=$1 AND collection='Properties' AND id=$2")
        .bind(workspace).bind(record).fetch_optional(&mut **tx).await?;
    Ok(payload.is_some_and(|p| !closed(&p)))
}
fn closed(payload: &Value) -> bool {
    let available = payload
        .get("listing_status")
        .and_then(Value::as_str)
        .is_some_and(|v| {
            ["available", "under offer"].contains(&v.trim().to_ascii_lowercase().as_str())
        });
    !available || super::publication_source_options::permit_expired(payload)
}
pub fn physical_key(
    emirate: &str,
    community: &str,
    building: &str,
    unit: &str,
) -> ApiResult<String> {
    let normalize = |v: &str| {
        v.chars()
            .filter(|c| c.is_alphanumeric())
            .flat_map(char::to_lowercase)
            .collect::<String>()
    };
    let values = [
        normalize(emirate),
        normalize(community),
        normalize(building),
        normalize(unit),
    ];
    if values.iter().any(String::is_empty) {
        return Err(ApiError::invalid("The private emirate, building and unit reference are required to identify this property."));
    }
    Ok(format!("{:x}", Sha256::digest(values.join("|").as_bytes())))
}
pub fn area_id(emirate: &str, community: &str) -> String {
    format!(
        "area-{:x}",
        Sha256::digest(format!("{}|{}", emirate, community.trim().to_lowercase()).as_bytes())
    )
}
pub fn media(payload: &Value) -> Vec<Uuid> {
    ["media_photos", "media_floorplans"]
        .iter()
        .flat_map(|key| {
            payload
                .get(key)
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
        })
        .filter_map(|asset| {
            asset
                .get("file")
                .and_then(Value::as_str)
                .and_then(|s| s.parse().ok())
        })
        .collect()
}
#[cfg(test)]
#[path = "publication_source_tests.rs"]
mod tests;
