//! The platform events for Blaqks One's own clients (docs/blaqks-one-console.md §3a): usage
//! events of the organisation with the actor's role, in the transaction that makes the
//! change. The event names the client's source or new stage, never a name, phone or email.
use super::model;
use crate::{
    error::ApiResult,
    platform_metrics::{self, names, Event, Source},
    workspaces::ORGANISATION,
};
use sqlx::{Postgres, Transaction};

async fn record(
    tx: &mut Transaction<'_, Postgres>,
    name: &str,
    role: Option<&str>,
    source: Source,
) -> ApiResult<()> {
    platform_metrics::record(tx, Event::usage(name, ORGANISATION, role, source)).await
}

/// A client added by the team (`role`) or by the marketing website's form (no role).
pub(super) async fn created(
    tx: &mut Transaction<'_, Postgres>,
    client_source: &str,
    role: Option<&str>,
) -> ApiResult<()> {
    let key = model::source(client_source).unwrap_or("other");
    let name = format!("{}_{key}", names::CLIENT_CREATED);
    let source = match role {
        Some(_) => Source::Crm,
        None => Source::GeneralSite,
    };
    record(tx, &name, role, source).await
}

/// A client moved to `stage`; `role` is empty when the sign-up moved it.
pub(super) async fn stage_changed(
    tx: &mut Transaction<'_, Postgres>,
    stage: &str,
    role: Option<&str>,
) -> ApiResult<()> {
    let key = model::stage(stage).unwrap_or("new");
    let name = format!("{}_{key}", names::CLIENT_STAGE_CHANGED);
    record(tx, &name, role, Source::Crm).await
}

/// A client linked to the company they signed up with.
pub(super) async fn linked(tx: &mut Transaction<'_, Postgres>) -> ApiResult<()> {
    record(tx, names::CLIENT_LINKED, None, Source::Crm).await
}
