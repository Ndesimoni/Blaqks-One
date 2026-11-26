//! Generic share DTOs use the same participant-only release gate as marketplace responses.
use super::{access::Caller, market_release, store::ShareRow};
use crate::error::ApiResult;
use serde_json::Value;
use sqlx::{Postgres, Transaction};

pub async fn attach(
    tx: &mut Transaction<'_, Postgres>,
    row: &ShareRow,
    caller: &Caller<'_>,
    mut view: Value,
) -> ApiResult<Value> {
    if row.origin != "marketplace" {
        return Ok(view);
    }
    let release = market_release::details(tx, row.id, caller).await?;
    if release["released"] == true {
        view["listing"] = release["listing"].clone();
        view["photos"] = release["photos"].clone();
        view["floorPlans"] = release["floorPlans"].clone();
        view["from"]["phone"] = release["contacts"]["broker"]["phone"].clone();
        view["to"]["phone"] = release["contacts"]["requester"]["phone"].clone();
        view["exactLocation"] = Value::Bool(true);
    }
    view["release"] = release;
    Ok(view)
}
