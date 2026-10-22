//! Display facts joined to agreement views for the screens (docs/agreements-design.md §13):
//! each named participant's name from the published identity view, each company's display
//! name from the workspaces owner, and a short summary of the current revision. Only
//! callers who may already read the agreement receive them; evidence never depends on them.
use super::rows::AgreementRow;
use crate::{
    error::{ApiError, ApiResult},
    workspaces,
};
use axum::http::StatusCode;
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

const FACTS: &str = "SELECT a.id, sp.name AS sender_name, rp.name AS recipient_name,
    r.number AS revision, r.author_party, r.terms->'money' AS money,
    r.terms->'subject'->'property' AS property
    FROM agreements.crm_agreements a
    JOIN agreements.crm_agreement_participants s ON s.agreement_id=a.id AND s.party='sender'
    JOIN agreements.crm_agreement_participants p ON p.agreement_id=a.id AND p.party='recipient'
    JOIN agreements.crm_agreement_revisions r ON r.id=a.current_revision_id
    LEFT JOIN crm_all_user_profiles sp ON sp.id=s.member_id
    LEFT JOIN crm_all_user_profiles rp ON rp.id=p.member_id
    WHERE a.id=ANY($1)";

#[derive(sqlx::FromRow)]
struct Facts {
    id: Uuid,
    sender_name: Option<String>,
    recipient_name: Option<String>,
    revision: i32,
    author_party: String,
    money: Value,
    property: Value,
}

/// A company's display name; `None` until the company sets one up.
pub async fn company(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<Option<String>> {
    match workspaces::company::get(&mut **tx, workspace).await {
        Ok(found) => Ok(found.display_name),
        Err(ApiError(StatusCode::FORBIDDEN, ..)) => Ok(None),
        Err(other) => Err(other),
    }
}

/// The wire views of `rows` with both parties' names and the current revision's summary.
pub async fn views(
    tx: &mut Transaction<'_, Postgres>,
    rows: &[AgreementRow],
) -> ApiResult<Vec<Value>> {
    let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let facts: HashMap<Uuid, Facts> = sqlx::query_as::<_, Facts>(FACTS)
        .bind(&ids)
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|fact| (fact.id, fact))
        .collect();
    let mut companies: HashMap<String, Option<String>> = HashMap::new();
    for row in rows {
        for workspace in [&row.workspace_id, &row.recipient_workspace_id] {
            if !companies.contains_key(workspace) {
                let name = company(tx, workspace).await?;
                companies.insert(workspace.clone(), name);
            }
        }
    }
    Ok(rows
        .iter()
        .map(|row| view(row, facts.get(&row.id), &companies))
        .collect())
}

fn view(
    row: &AgreementRow,
    facts: Option<&Facts>,
    companies: &HashMap<String, Option<String>>,
) -> Value {
    let mut value = row.view();
    let company = |workspace: &str| companies.get(workspace).cloned().flatten();
    value["parties"] = json!({
        "sender": {
            "name": facts.and_then(|fact| fact.sender_name.clone()),
            "company": company(&row.workspace_id),
        },
        "recipient": {
            "name": facts.and_then(|fact| fact.recipient_name.clone()),
            "company": company(&row.recipient_workspace_id),
        },
    });
    value["summary"] = facts.map_or(Value::Null, |fact| {
        json!({
            "revision": fact.revision,
            "authorParty": fact.author_party,
            "area": fact.property["area"],
            "listingRef": fact.property["listingRef"],
            "amountFils": fact.money["amountFils"],
            "senderShareBp": fact.money["senderShareBp"],
            "recipientShareBp": fact.money["recipientShareBp"],
        })
    });
    value
}
