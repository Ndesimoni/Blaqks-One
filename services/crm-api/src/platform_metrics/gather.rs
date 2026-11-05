//! Collects every figure from the module that owns it (service-boundaries rule 3): each
//! owner returns counts and platform-wide sums from its own tables, inside the dashboard's
//! one read-only snapshot. This module reads only its own two tables.
use super::{active_days, log, names, period::Period};
use crate::{
    agreements::platform_counts as agreements, auth::sessions, chat::platform_counts as chat,
    enquiries::platform_counts as enquiries, error::ApiResult, finance::platform_counts as finance,
    inbox::platform_counts as inbox, marketplace::platform_counts as marketplace,
    platform_clients::platform_counts as own_clients,
    publications::platform_counts as publications, records::platform_counts as records,
    sites::platform_counts as sites, support::platform_counts as support,
    team::platform_counts as team, workspaces::ORGANISATION,
};
use sqlx::{Postgres, Transaction};
use std::collections::HashSet;
use uuid::Uuid;

pub struct Gathered {
    pub users: team::Users,
    pub users_new: (i64, Vec<(String, i64)>),
    pub active: (i64, i64, i64),
    pub monthly_active: Vec<(String, i64)>,
    /// The first day daily activity was recorded, if any.
    pub tracked_from: Option<String>,
    pub activity: Vec<active_days::Company>,
    pub companies_by_month: (i64, i64),
    pub last_seen: Vec<(String, String)>,
    pub records: Vec<(String, i64)>,
    pub records_by_company: Vec<(String, i64)>,
    pub added: records::Added,
    pub sites: (i64, bool),
    pub listings: i64,
    pub enquiries: enquiries::Enquiries,
    pub enquiries_to_leads: i64,
    pub website_sales: (i64, i64),
    pub deals: finance::Deals,
    pub earned: finance::Earned,
    pub payments: (i64, i64),
    pub first_earned: Vec<(String, String)>,
    pub between: agreements::BetweenCompanies,
    pub between_months: Vec<(String, i64)>,
    pub market: marketplace::Marketplace,
    pub messages: (i64, i64),
    pub chat: i64,
    pub sign_ins: i64,
    pub help: support::Help,
    pub sales: own_clients::Sales,
}

pub async fn gather(tx: &mut Transaction<'_, Postgres>, period: &Period) -> ApiResult<Gathered> {
    let org = ORGANISATION;
    let (since, trend) = (period.since.as_str(), period.trend.as_str());
    let enquiries = enquiries::counts(tx, org, since, trend).await?;
    let (to_leads, sales) = website_leads(tx, &enquiries.leads, since).await?;
    Ok(Gathered {
        users: team::users(tx, org).await?,
        users_new: team::created(tx, org, since, trend).await?,
        active: active_days::users(tx, org).await?,
        monthly_active: active_days::monthly(tx, org, trend).await?,
        tracked_from: active_days::first_day(tx).await?,
        activity: active_days::companies(tx, org).await?,
        companies_by_month: active_days::companies_by_month(tx, org).await?,
        last_seen: sessions::last_seen_by_workspace(tx).await?,
        records: records::by_collection(tx, org).await?,
        records_by_company: records::by_company(tx, org).await?,
        added: records::added(tx, org, since, trend).await?,
        sites: sites::live(tx).await?,
        listings: publications::live(tx).await?,
        enquiries,
        enquiries_to_leads: to_leads,
        website_sales: sales,
        deals: finance::deals(tx, org).await?,
        earned: finance::earned(tx, org, since, trend).await?,
        payments: finance::payments(tx, org).await?,
        first_earned: finance::first_earned(tx, org).await?,
        between: agreements::between_companies(tx, org, since).await?,
        between_months: agreements::accepted_by_month(tx, org, trend).await?,
        market: marketplace::totals(tx, org).await?,
        messages: inbox::sent(tx, org, since).await?,
        chat: chat::sent(tx, org, since).await?,
        sign_ins: log::count(tx, org, names::SIGN_IN, since).await?,
        help: support::help(tx, since).await?,
        sales: own_clients::sales(tx, since).await?,
    })
}

/// Enquiries in the period whose lead is still kept, and the deals earned in the period by
/// clients who came in through any website enquiry ("property sold through the websites").
async fn website_leads(
    tx: &mut Transaction<'_, Postgres>,
    leads: &[(Uuid, bool)],
    since: &str,
) -> ApiResult<(i64, (i64, i64))> {
    let ids: Vec<Uuid> = leads.iter().map(|(id, _)| *id).collect();
    let kept = records::lead_clients(tx, &ids).await?;
    let kept_ids: HashSet<Uuid> = kept.iter().map(|(id, _, _)| *id).collect();
    let recent = leads
        .iter()
        .filter(|(id, recent)| *recent && kept_ids.contains(id))
        .count();
    let clients: Vec<(String, String)> = kept
        .into_iter()
        .map(|(_, workspace, client)| (workspace, client))
        .collect();
    let sales = finance::sold_to(tx, &clients, since).await?;
    Ok((i64::try_from(recent).unwrap_or(i64::MAX), sales))
}
