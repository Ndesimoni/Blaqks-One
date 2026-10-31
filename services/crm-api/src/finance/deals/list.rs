//! Visible deals with their figures: current snapshots for earned deals and previews
//! (today's settings and agreements) for the rest.
use super::{
    compute::{self, Basis},
    figures::Figures,
    names::second_source,
    row::{self, DealRow},
    snapshot,
    views::{self, Viewer},
};
use crate::{auth::profile::UserRow, error::ApiResult, finance::settings_store};
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

pub struct Loaded {
    pub rows: Vec<DealRow>,
    pub figures: HashMap<Uuid, Figures>,
}

impl Loaded {
    pub fn views(&self, viewer: &Viewer) -> Vec<Value> {
        self.rows
            .iter()
            .map(|deal| views::deal(deal, self.figures.get(&deal.id), viewer))
            .collect()
    }
}

/// Agreements in force today (Asia/Dubai), by agent.
async fn agreements_today(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
) -> ApiResult<HashMap<Uuid, (Uuid, i32)>> {
    let rows: Vec<(Uuid, Uuid, i32)> = sqlx::query_as(
        "SELECT agent_id,id,agent_share_bp FROM crm_commission_agreements \
         WHERE workspace_id=$1 AND effective_from <= (now() AT TIME ZONE 'Asia/Dubai')::date \
         AND (effective_to IS NULL OR effective_to > (now() AT TIME ZONE 'Asia/Dubai')::date)",
    )
    .bind(workspace)
    .fetch_all(&mut **transaction)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(agent, id, share)| (agent, (id, share)))
        .collect())
}

/// Loads the deals `user` may see (optionally one holder's, or one deal).
pub async fn load(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    holder: Option<Uuid>,
    only: Option<Uuid>,
) -> ApiResult<Loaded> {
    let rows = row::visible(transaction, workspace, user, holder, only).await?;
    let earned: Vec<Uuid> = rows.iter().filter(|d| d.earned()).map(|d| d.id).collect();
    let (snapshots, lines) = snapshot::current(transaction, workspace, &earned).await?;
    let mut figures: HashMap<Uuid, Figures> = snapshots
        .iter()
        .map(|snapshot| (snapshot.deal_id, Figures::from_snapshot(snapshot, &lines)))
        .collect();
    let settings = settings_store::load(transaction, workspace, false).await?;
    let unearned = rows.iter().filter(|deal| !deal.earned());
    if let (Some(settings), true) = (settings, rows.iter().any(|deal| !deal.earned())) {
        let agreements = agreements_today(transaction, workspace).await?;
        for deal in unearned {
            let primary = deal.assignee_id.filter(|_| deal.assignee_staff);
            let basis = Basis {
                primary,
                agreement: primary.and_then(|agent| agreements.get(&agent).copied()),
                team_default_bp: settings.agent_share_bp,
                team_second_source: second_source(&settings.second_agent_source),
                vat_registered: settings.vat_registered,
            };
            if let Ok(outcome) = compute::compute(deal, basis) {
                figures.insert(deal.id, Figures::preview(deal, &outcome));
            }
        }
    }
    Ok(Loaded { rows, figures })
}

/// One deal as `user` now sees it, or `None` when it is no longer visible.
pub async fn entry(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    user: &UserRow,
    id: Uuid,
) -> ApiResult<Option<Value>> {
    let loaded = load(transaction, workspace, user, None, Some(id)).await?;
    Ok(loaded.views(&Viewer::of(user)).into_iter().next())
}
