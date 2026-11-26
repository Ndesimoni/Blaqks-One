//! Blaqks One's own sales figures for its dashboard (BO1e, docs/blaqks-one-console.md §9):
//! counts of kept clients only; names and contact details never leave the schema.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};

pub struct Sales {
    /// Kept (not archived) clients today.
    pub clients: i64,
    /// Clients linked to the company they became through the public sign-up.
    pub became_companies: i64,
    pub customers: i64,
    pub lost: i64,
    /// Added on or after the period's first day.
    pub added: i64,
    /// Added in the period by the marketing website's contact form.
    pub from_website: i64,
}

/// The figures from `since`, an Asia/Dubai day.
pub async fn sales(tx: &mut Transaction<'_, Postgres>, since: &str) -> ApiResult<Sales> {
    let (clients, became_companies, customers, lost, added, from_website): (
        i64,
        i64,
        i64,
        i64,
        i64,
        i64,
    ) = sqlx::query_as(
        "WITH start AS (SELECT (($1::date)::timestamp AT TIME ZONE 'Asia/Dubai') AS at) \
         SELECT count(*), count(*) FILTER (WHERE c.linked_workspace_id IS NOT NULL), \
           count(*) FILTER (WHERE c.stage='customer'), count(*) FILTER (WHERE c.stage='lost'), \
           count(*) FILTER (WHERE c.created_at>=start.at), \
           count(*) FILTER (WHERE c.created_at>=start.at AND c.source='website_form') \
         FROM platform_clients.crm_platform_clients c CROSS JOIN start \
         WHERE c.archived_at IS NULL",
    )
    .bind(since)
    .fetch_one(&mut **tx)
    .await?;
    Ok(Sales {
        clients,
        became_companies,
        customers,
        lost,
        added,
        from_website,
    })
}
