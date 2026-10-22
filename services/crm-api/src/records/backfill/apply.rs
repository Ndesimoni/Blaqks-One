//! `--apply` for one record: reserve its files (committed), put their bytes, then rewrite the
//! media fields and confirm the files in the record's own transaction with its version check.
//! If storage fails, the record changed or the check refuses, nothing in the record changes
//! and the reserved files are hidden at once (or, if even that fails, by the sweep).
use super::{
    inline::stored_entry,
    plan::{Plan, PHOTOS},
    store::{self, Committed, Current},
};
use crate::{
    config::media_settings::MediaConfig,
    error::ApiResult,
    media::backfill as media,
    records::{media_links::KIND, validation},
};
use serde_json::{Map, Value};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    Moved,
    ChangedMeanwhile,
    Failed,
    Frozen,
}

pub struct Target<'a> {
    pub pool: &'a PgPool,
    pub config: &'a MediaConfig,
    pub workspace: &'a str,
    /// The workspace owner, recorded as the files' uploader (as for inbound mail).
    pub uploader: Uuid,
}

pub async fn apply(target: &Target<'_>, record: &Current, plan: Plan) -> ApiResult<Outcome> {
    let files: Vec<_> = plan.moves.iter().map(|item| &item.file).collect();
    let owner = (KIND, record.id);
    let reserved = media::reserve(
        target.pool,
        target.workspace,
        target.uploader,
        owner,
        &files,
    )
    .await?;
    let ids: Vec<Uuid> = reserved.iter().map(|(id, _)| *id).collect();
    let mut fields = Map::new();
    for (item, (id, key)) in plan.moves.into_iter().zip(&reserved) {
        let (name, kind) = (item.file.name, item.file.kind);
        let assets = fields
            .entry(item.field)
            .or_insert_with(|| original(record, item.field));
        let slot = assets
            .as_array_mut()
            .and_then(|list| list.get_mut(item.index));
        let stored = match slot {
            Some(slot) => media::put(target.config, key, kind, item.file.bytes)
                .await
                .then_some(slot),
            None => None,
        };
        let Some(slot) = stored else {
            media::discard(target.pool, &ids).await?;
            return Ok(Outcome::Failed);
        };
        *slot = stored_entry(&name, *id, kind.content_type(), item.added.as_deref());
    }
    let fields = Value::Object(fields);
    // The rewritten fields must be exactly what a member's save would accept.
    if validation::media::validate(&fields).is_err() {
        media::discard(target.pool, &ids).await?;
        return Ok(Outcome::Failed);
    }
    let committed = store::commit(target.pool, target.workspace, record, &fields, &ids).await;
    let outcome = match committed {
        Ok(Committed::Done) => return Ok(Outcome::Moved),
        Ok(Committed::Stale) => Outcome::ChangedMeanwhile,
        Ok(Committed::Frozen) => Outcome::Frozen,
        Err(error) => {
            // Best effort; the sweep hides anything left unconfirmed after an hour.
            let _ = media::discard(target.pool, &ids).await;
            return Err(error);
        }
    };
    media::discard(target.pool, &ids).await?;
    Ok(outcome)
}

/// The field as read, copied once when its first entry moves.
fn original(record: &Current, field: &str) -> Value {
    let value = if field == PHOTOS {
        &record.photos
    } else {
        &record.plans
    };
    value.clone().unwrap_or(Value::Null)
}
