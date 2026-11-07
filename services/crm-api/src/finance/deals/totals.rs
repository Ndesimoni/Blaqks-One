//! Team totals and references for `GET /finance` (finance-design §5.4, §6.2). Totals use
//! current snapshots of the deals in scope and approved receipts only; references name
//! clients and properties only for callers holding those module grants (M1).
use super::list::Loaded;
use crate::finance::statement::line_figures;
use crate::{auth::profile::UserRow, error::ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use std::collections::BTreeMap;
use uuid::Uuid;

pub fn team(loaded: &Loaded) -> Value {
    let mut sums = [0i128; 7]; // gross, partner, net, company, vat, received, outstanding
    let mut agents: BTreeMap<Uuid, (String, i128, i128)> = BTreeMap::new();
    for deal in &loaded.rows {
        let Some(figures) = loaded.figures.get(&deal.id).filter(|f| !f.preview) else {
            continue;
        };
        let received = deal.approved_fils.clamp(0, figures.net_fils.max(0));
        let outstanding = figures.net_fils.saturating_sub(received).max(0);
        let values = [
            figures.gross_fils,
            figures.partner_fils,
            figures.net_fils,
            figures.company_fils,
            figures.vat_fils,
            received,
            outstanding,
        ];
        for (sum, value) in sums.iter_mut().zip(values) {
            *sum += i128::from(value);
        }
        for line in &figures.lines {
            let (share, _) = line_figures(line.amount_fils, deal.approved_fils, figures.net_fils);
            let entry = agents
                .entry(line.agent_id)
                .or_insert((line.agent_name.clone(), 0, 0));
            entry.1 += i128::from(line.amount_fils);
            entry.2 += i128::from(share);
        }
    }
    let fils = |total: i128| i64::try_from(total).unwrap_or(i64::MAX);
    let by_agent: Vec<Value> = agents
        .into_iter()
        .map(|(id, (name, earned, received))| {
            json!({"agent": {"id": id, "name": name},
            "earnedFils": fils(earned), "receivedShareFils": fils(received)})
        })
        .collect();
    json!({"grossFils": fils(sums[0]), "partnerFils": fils(sums[1]), "netFils": fils(sums[2]),
        "companyFils": fils(sums[3]), "vatFils": fils(sums[4]), "receivedFils": fils(sums[5]),
        "outstandingFils": fils(sums[6]), "expensesApprovedFils": 0, "pendingCount": 0,
        "byAgent": by_agent})
}

pub async fn references<'a>(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    loaded: &'a Loaded,
    expense_properties: Vec<&'a str>,
) -> ApiResult<Value> {
    let clients = loaded.rows.iter().map(|d| d.client_ref.as_str());
    let properties = loaded
        .rows
        .iter()
        .filter_map(|d| d.property_ref.as_deref())
        .chain(expense_properties);
    let granted = |collection, ids: Vec<&'a str>| match user.can_collection(collection) {
        true => ids,
        false => vec![],
    };
    let wanted = [
        (
            "Clients",
            "client_id",
            "full_name",
            granted("Clients", clients.collect()),
        ),
        (
            "Properties",
            "property_id",
            "listing_title",
            granted("Properties", properties.collect()),
        ),
    ];
    let mut body = json!({});
    for (collection, key, field, ids) in wanted {
        let rows: Vec<(String, Option<String>)> = sqlx::query_as(
            "SELECT DISTINCT legacy_id,payload->>$4 FROM crm_records WHERE workspace_id=$1 \
             AND collection=$2 AND legacy_id=ANY($3) ORDER BY legacy_id",
        )
        .bind(workspace)
        .bind(collection)
        .bind(&ids)
        .bind(field)
        .fetch_all(&mut **tx)
        .await?;
        let list: Vec<Value> = rows
            .into_iter()
            .map(|(id, name)| json!({key: id, field: name}))
            .collect();
        body[collection] = Value::Array(list);
    }
    Ok(body)
}
