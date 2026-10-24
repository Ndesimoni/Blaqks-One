//! What a listing share shows its two named people about co-broking (docs/record-sharing.md
//! R2): the agreement it led to that still stands (accepted, completed or an unexpired
//! offer) or their own draft, the property a proposal would freeze, and whether they may
//! propose one now. Everyone else reads no co-broking at all.
use super::{access::Caller, store::ShareRow};
use crate::{agreements::introduction, error::ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn attach(
    tx: &mut Transaction<'_, Postgres>,
    row: &ShareRow,
    caller: &Caller<'_>,
    mut view: Value,
) -> ApiResult<Value> {
    // The place the view was built for, so an introducer (review L7) is never named.
    let named = match view["viewer"].as_str() {
        Some("sender") => caller.workspace == row.workspace_id && caller.id == row.from_id,
        Some("agent") => true,
        _ => false,
    };
    let found: Option<(Uuid, String)> = match named {
        false => None,
        true => {
            sqlx::query_as(
                "SELECT a.id,a.state FROM agreements.crm_agreements a \
                 JOIN agreements.crm_agreement_revisions r ON r.id=a.current_revision_id \
                 WHERE a.listing_share_id=$1 AND (a.state IN ('accepted','completed') \
                   OR (a.state='sent' AND (r.terms->>'expiresAt')::timestamptz>clock_timestamp()) \
                   OR (a.state='draft' AND a.created_by=$2)) \
                 ORDER BY a.state='draft',a.created_at DESC LIMIT 1",
            )
            .bind(row.id)
            .bind(caller.id)
            .fetch_optional(&mut **tx)
            .await?
        }
    };
    let allowed = named && row.shown_to_agent() && found.is_none();
    view["allowed"]["coBroking"] = json!(allowed);
    view["coBroking"] = found.map_or(Value::Null, |(id, state)| json!({"id": id, "state": state}));
    view["coBrokingProperty"] = match allowed {
        true => introduction::property(&row.facts, &row.reference),
        false => Value::Null,
    };
    Ok(view)
}
