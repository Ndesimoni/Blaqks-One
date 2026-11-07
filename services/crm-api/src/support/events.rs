//! Help request events for the dashboard (docs/blaqks-one-console.md §3a): the requester's
//! company and the actor's role, in the transaction that makes the change; never a subject,
//! a message or a name.
use crate::{
    error::ApiResult,
    platform_metrics::{self, Event, Source},
};
use sqlx::{Postgres, Transaction};

pub(super) async fn record(
    tx: &mut Transaction<'_, Postgres>,
    name: &str,
    company: &str,
    role: &str,
) -> ApiResult<()> {
    platform_metrics::record(tx, Event::usage(name, company, Some(role), Source::Crm)).await
}
