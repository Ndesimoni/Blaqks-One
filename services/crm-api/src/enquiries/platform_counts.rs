//! Website enquiry figures for Blaqks One's dashboard (BO1d, docs/blaqks-one-console.md
//! §3 item 4): counts only, never the visitor's details. Every enquiry creates a lead; the
//! lead IDs go to records and finance to count the leads still kept and the deals they
//! became, and are never returned.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'a> = Transaction<'a, Postgres>;

pub struct Enquiries {
    pub in_period: i64,
    pub months: Vec<(String, i64)>,
    /// Every enquiry's lead, and whether the enquiry came in on or after `since`.
    pub leads: Vec<(Uuid, bool)>,
}

pub async fn counts(
    tx: &mut Tx<'_>,
    organisation: &str,
    since: &str,
    trend: &str,
) -> ApiResult<Enquiries> {
    let leads: Vec<(Uuid, bool)> = sqlx::query_as(
        "SELECT lead_id,created_at>=(($2::date)::timestamp AT TIME ZONE 'Asia/Dubai') \
         FROM enquiries.crm_website_enquiries WHERE workspace_id<>$1",
    )
    .bind(organisation)
    .bind(since)
    .fetch_all(&mut **tx)
    .await?;
    let months = sqlx::query_as(
        "SELECT to_char(created_at AT TIME ZONE 'Asia/Dubai','YYYY-MM') AS month,count(*) \
         FROM enquiries.crm_website_enquiries WHERE workspace_id<>$1 \
         AND created_at>=(($2::date)::timestamp AT TIME ZONE 'Asia/Dubai') GROUP BY month",
    )
    .bind(organisation)
    .bind(trend)
    .fetch_all(&mut **tx)
    .await?;
    let in_period = leads.iter().filter(|(_, recent)| *recent).count();
    Ok(Enquiries {
        in_period: i64::try_from(in_period).unwrap_or(i64::MAX),
        months,
        leads,
    })
}
