use super::{
    audit, deal_links,
    history::{self, Change},
    links, target,
    validation::ValidatedRecord,
    visibility::RecordScope,
};
use crate::{auth::grants::Action, error::ApiResult};
use serde::Serialize;
use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

/// One record as the API returns it. `assignee` comes only from the database column.
#[derive(Serialize, FromRow)]
pub struct Entry {
    pub id: Uuid,
    pub version: i64,
    #[sqlx(rename = "payload")]
    pub record: Value,
    #[sqlx(rename = "assignee_id")]
    pub assignee: Option<Uuid>,
}

/// Columns every statement returning an [`Entry`] selects.
pub const ENTRY_COLUMNS: &str = "id,version,payload,assignee_id";

pub struct Update<'a> {
    pub actor: Uuid,
    pub workspace: &'a str,
    pub collection: &'a str,
    pub id: Uuid,
    pub version: i64,
    pub record: ValidatedRecord,
}

/// Steps 4–10 of an update (contract §4); the handler has run steps 1–3.
pub async fn update(pool: &PgPool, update: Update<'_>) -> ApiResult<Entry> {
    let (workspace, collection) = (update.workspace, update.collection);
    let mut transaction = pool.begin().await?;
    crate::workspaces::lock(&mut transaction, workspace).await?;
    let user = crate::workspaces::ensure_writable(
        &mut transaction,
        workspace,
        update.actor,
        Some(collection),
        Some(Action::Edit),
    )
    .await?;
    let scope = RecordScope::of(&user);
    let found = target::fetch(&mut transaction, workspace, collection, update.id, scope).await?;
    target::ensure_version(
        &found,
        update.version,
        "This record changed. Reload before saving.",
    )?;
    let record = update.record;
    target::ensure_update_allowed(&user, collection, &found, &record)?;
    let previous = found.links();
    links::ensure_linkable(
        &mut transaction,
        workspace,
        scope,
        &record.links,
        Some(&previous),
        Some(found.id),
    )
    .await?;
    deal_links::ensure(
        &mut transaction,
        workspace,
        &user,
        &record.links,
        Some(&previous),
    )
    .await?;
    target::ensure_client(scope, collection, &record.links)?;
    let clientless = record.links.client.is_none();
    // assignee_id is deliberately absent: plain edits never fire the eligibility trigger.
    let sql = format!(
        "UPDATE crm_records SET legacy_id=$1,payload=$2,contact_id=$3,client_ref=$4,\
         property_ref=$5,referral_ref=$6,deal_ref=$7,version=version+1,updated_at=now() \
         WHERE id=$8 RETURNING {ENTRY_COLUMNS}"
    );
    let mut saved = sqlx::query_as::<_, Entry>(&sql)
        .bind(record.legacy_id)
        .bind(record.payload)
        .bind(record.links.contact)
        .bind(record.links.client)
        .bind(record.links.property)
        .bind(record.links.referral)
        .bind(record.links.deal)
        .bind(found.id)
        .fetch_one(&mut *transaction)
        .await?;
    let actor = update.actor;
    audit::append(
        &mut transaction,
        actor,
        workspace,
        "updated",
        collection,
        found.id,
    )
    .await?;
    // H3: an assigned-only caller who leaves a Follow-up with no client and no
    // assignee keeps it, so it never becomes invisible to everyone but the team.
    if let RecordScope::Assigned(caller) = scope {
        if collection == "Follow-ups" && clientless && found.assignee_id.is_none() {
            let change = Change {
                workspace,
                record: found.id,
                collection,
                from: None,
                to: Some(caller),
                actor,
                reason: "reassigned",
            };
            history::reassign(&mut transaction, &change, false).await?;
            saved.assignee = Some(caller);
        }
    }
    transaction.commit().await?;
    Ok(saved)
}
