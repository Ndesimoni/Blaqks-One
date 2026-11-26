//! The revise body and its basis (finance-design §2.4, §13 M-F3): a revision keeps the
//! superseded snapshot's primary agent, agreement, team default, second-agent source and
//! VAT registration unless the Admin explicitly changes the agent or agreement.
use super::{
    compute::{self, Basis},
    gate, links,
    names::second_source,
    snapshot::SnapshotRow,
    split::{nullable_bp, second},
};
use crate::{
    error::{ApiError, ApiResult},
    finance::{errors::INELIGIBLE, wire},
};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub const AGREEMENT: &str = "Choose an agreement of the primary agent.";
pub const INVALID: &str = "Provide a version, a reason and any split changes.";
const KEYS: [&str; 7] = [
    "version",
    "reason",
    "primaryAgentId",
    "agreementId",
    "secondAgentId",
    "secondAgentShareBp",
    "overrideAgentShareBp",
];

/// Optional changes: `None` keeps the current value; `Some(None)` clears it.
pub struct Revision {
    pub version: i64,
    pub reason: String,
    pub primary: Option<Option<Uuid>>,
    pub agreement: Option<Option<Uuid>>,
    pub second: Option<Option<(Uuid, i32)>>,
    pub override_bp: Option<Option<i32>>,
}

fn nullable_uuid(value: &Value, message: &'static str) -> ApiResult<Option<Uuid>> {
    match value {
        Value::Null => Ok(None),
        value => wire::uuid(value, message).map(Some),
    }
}

pub fn parse(body: Value) -> ApiResult<Revision> {
    let Value::Object(body) = body else {
        return Err(ApiError::invalid(INVALID));
    };
    let known = body.keys().all(|key| KEYS.contains(&key.as_str()));
    let paired = body.contains_key("secondAgentId") == body.contains_key("secondAgentShareBp");
    if !known || !body.contains_key("version") || !body.contains_key("reason") || !paired {
        return Err(ApiError::invalid(INVALID));
    }
    let get = |key: &str| body.get(key);
    Ok(Revision {
        version: gate::version(&body["version"])?,
        reason: gate::reason(&body["reason"])?,
        primary: get("primaryAgentId")
            .map(|v| nullable_uuid(v, INELIGIBLE))
            .transpose()?,
        agreement: get("agreementId")
            .map(|v| nullable_uuid(v, AGREEMENT))
            .transpose()?,
        second: match (get("secondAgentId"), get("secondAgentShareBp")) {
            (Some(id), Some(share)) => Some(second(id, share)?),
            _ => None,
        },
        override_bp: get("overrideAgentShareBp").map(nullable_bp).transpose()?,
    })
}

/// The basis of the next revision from the superseded snapshot and the requested changes.
pub async fn basis(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    previous: &SnapshotRow,
    revision: &Revision,
) -> ApiResult<Basis> {
    let inputs = &previous.inputs.0;
    let primary = revision.primary.unwrap_or(previous.primary_agent_id);
    let changed = primary != previous.primary_agent_id;
    if let Some(agent) = primary.filter(|_| changed) {
        if !links::finance_member(tx, workspace, agent, true).await? {
            return Err(ApiError::invalid(INELIGIBLE));
        }
    }
    let agreement = match (revision.agreement, primary) {
        (Some(None), _) | (_, None) => None,
        (Some(Some(id)), Some(agent)) => {
            let found: Option<(Uuid, i32)> = sqlx::query_as(
                "SELECT id,agent_share_bp FROM crm_commission_agreements \
                 WHERE id=$1 AND workspace_id=$2 AND agent_id=$3",
            )
            .bind(id)
            .bind(workspace)
            .bind(agent)
            .fetch_optional(&mut **tx)
            .await?;
            Some(found.ok_or(ApiError::invalid(AGREEMENT))?)
        }
        (None, Some(agent)) if changed => {
            compute::agreement_on(tx, workspace, agent, &previous.earned_on).await?
        }
        (None, Some(_)) => previous.agreement_id.zip(
            inputs["agreementShareBp"]
                .as_i64()
                .and_then(|share| i32::try_from(share).ok()),
        ),
    };
    let team_default_bp = inputs["teamDefaultBp"].as_i64().unwrap_or(0);
    Ok(Basis {
        primary,
        agreement,
        team_default_bp: i32::try_from(team_default_bp).unwrap_or(0),
        team_second_source: second_source(inputs["teamSecondSource"].as_str().unwrap_or("")),
        vat_registered: previous.vat_registered,
    })
}
