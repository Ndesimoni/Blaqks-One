//! The caller's place in a listing share. A member who sent a share but no longer holds
//! the listing, and is not the Admin, is its introducer: they keep the introduction record
//! and the evidence, while the listing's details, photos and files stay hidden (R2a
//! security review L7, owner decision 2026-10-24).
use super::{
    access::{self, Caller, Viewer},
    store::ShareRow,
};
use crate::{error::ApiResult, records::listing_holders};
use sqlx::{Postgres, Transaction};
use std::collections::HashSet;
use uuid::Uuid;

/// The caller's place in `row` by the two named people and the Admins, if any.
pub fn viewer(row: &ShareRow, caller: &Caller) -> Option<Viewer> {
    access::viewer(
        caller,
        (&row.workspace_id, row.from_id),
        (&row.recipient_workspace_id, row.to_id),
    )
}

/// The listings of `rows` that the caller sent and still holds (an Admin needs none).
pub async fn held(
    tx: &mut Transaction<'_, Postgres>,
    rows: &[ShareRow],
    caller: &Caller<'_>,
) -> ApiResult<HashSet<Uuid>> {
    let sent: Vec<Uuid> = rows
        .iter()
        .filter(|row| !caller.admin && row.workspace_id == caller.workspace)
        .filter(|row| row.from_id == caller.id)
        .map(|row| row.source_record_id)
        .collect();
    listing_holders::held_by(tx, caller.workspace, caller.id, &sent).await
}

/// The caller's place in `row`, with `held` from `held`.
pub fn place(row: &ShareRow, caller: &Caller, held: &HashSet<Uuid>) -> Option<Viewer> {
    match viewer(row, caller) {
        Some(Viewer::Sender) if !caller.admin && !held.contains(&row.source_record_id) => {
            Some(Viewer::Introducer)
        }
        other => other,
    }
}

/// The caller's place in one share, with the holder check.
pub async fn one(
    tx: &mut Transaction<'_, Postgres>,
    row: &ShareRow,
    caller: &Caller<'_>,
) -> ApiResult<Option<Viewer>> {
    let held = held(tx, std::slice::from_ref(row), caller).await?;
    Ok(place(row, caller, &held))
}
