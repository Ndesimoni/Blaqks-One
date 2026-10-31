use super::{
    audit, deal_links,
    history::{self, Change},
    ids, links,
    mutation::{Entry, ENTRY_COLUMNS},
    target,
    validation::ValidatedRecord,
    visibility::RecordScope,
};
use crate::{
    auth::grants::Action,
    error::{ApiError, ApiResult},
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

pub const ISSUED_IDS: &str = "Record IDs are issued by the server.";

/// Step 3 scope rule: assigned-only callers never type record IDs.
pub fn ensure_id_allowed(scope: RecordScope, record: &ValidatedRecord) -> ApiResult<()> {
    if !scope.is_team() && !record.legacy_id.is_empty() {
        return Err(ApiError::invalid(ISSUED_IDS));
    }
    Ok(())
}

/// Steps 4, ID allocation, then 8–10 of a create (contract §4); the handler has run 1–3.
pub async fn create(
    pool: &PgPool,
    actor: Uuid,
    workspace: &str,
    collection: &str,
    record: ValidatedRecord,
) -> ApiResult<Entry> {
    let mut transaction = pool.begin().await?;
    crate::workspaces::lock(&mut transaction, workspace).await?;
    let saved = create_in(&mut transaction, actor, workspace, collection, record).await?;
    transaction.commit().await?;
    Ok(saved)
}

/// The same create inside the caller's transaction, which must already hold the
/// workspace lock. Other modules (the Inbox's Create lead) use it so the new record and
/// their own change commit together.
pub async fn create_in(
    transaction: &mut Transaction<'_, Postgres>,
    actor: Uuid,
    workspace: &str,
    collection: &str,
    mut record: ValidatedRecord,
) -> ApiResult<Entry> {
    let id = Uuid::new_v4();
    let user = crate::workspaces::ensure_writable(
        transaction,
        workspace,
        actor,
        Some(collection),
        Some(Action::Create),
    )
    .await?;
    let scope = RecordScope::of(&user);
    ensure_id_allowed(scope, &record)?;
    if record.legacy_id.is_empty() {
        let issued = ids::issue(transaction, workspace, collection).await?;
        record.issue_id(collection, issued)?;
    }
    links::ensure_linkable(transaction, workspace, scope, &record.links, None, None).await?;
    deal_links::ensure(transaction, workspace, &user, &record.links, None).await?;
    target::ensure_client(scope, collection, &record.links)?;
    let files = super::media_links::referenced(&record.payload);
    let holder = history::default_holder(transaction, workspace, &user).await?;
    let assignee = history::initial(collection, holder, &record.links);
    let sql = format!(
        "INSERT INTO crm_records \
         (id,workspace_id,collection,legacy_id,payload,contact_id,client_ref,property_ref,\
         referral_ref,deal_ref,assignee_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) \
         RETURNING {ENTRY_COLUMNS}"
    );
    let saved = sqlx::query_as::<_, Entry>(&sql)
        .bind(id)
        .bind(workspace)
        .bind(collection)
        .bind(record.legacy_id)
        .bind(record.payload)
        .bind(record.links.contact)
        .bind(record.links.client)
        .bind(record.links.property)
        .bind(record.links.referral)
        .bind(record.links.deal)
        .bind(assignee)
        .fetch_one(&mut **transaction)
        .await?;
    super::media_links::sync(transaction, workspace, actor, id, &files).await?;
    audit::append(transaction, actor, workspace, "created", collection, id).await?;
    if assignee.is_some() {
        let change = Change {
            workspace,
            record: id,
            collection,
            from: None,
            to: assignee,
            actor,
            reason: "created",
        };
        history::append(transaction, &change).await?;
    }
    Ok(saved)
}
