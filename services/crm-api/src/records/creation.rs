use super::{
    audit,
    history::{self, Change},
    ids, links,
    mutation::{Entry, ENTRY_COLUMNS},
    target,
    validation::ValidatedRecord,
    visibility::RecordScope,
};
use crate::error::{ApiError, ApiResult};
use sqlx::PgPool;
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
    mut record: ValidatedRecord,
) -> ApiResult<Entry> {
    let id = Uuid::new_v4();
    let mut transaction = pool.begin().await?;
    crate::workspaces::lock(&mut transaction, workspace).await?;
    let user =
        crate::workspaces::ensure_writable(&mut transaction, workspace, actor, Some(collection))
            .await?;
    let scope = RecordScope::of(&user);
    ensure_id_allowed(scope, &record)?;
    if record.legacy_id.is_empty() {
        let issued = ids::issue(&mut transaction, workspace, collection).await?;
        record.issue_id(collection, issued)?;
    }
    links::ensure_linkable(
        &mut transaction,
        workspace,
        scope,
        &record.links,
        None,
        None,
    )
    .await?;
    target::ensure_client(scope, collection, &record.links)?;
    let holder = history::default_holder(&mut transaction, workspace, &user).await?;
    let assignee = history::initial(collection, holder, &record.links);
    let sql = format!(
        "INSERT INTO crm_records \
         (id,workspace_id,collection,legacy_id,payload,contact_id,client_ref,property_ref,\
         referral_ref,assignee_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) \
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
        .bind(assignee)
        .fetch_one(&mut *transaction)
        .await?;
    audit::append(
        &mut transaction,
        actor,
        workspace,
        "created",
        collection,
        id,
    )
    .await?;
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
        history::append(&mut transaction, &change).await?;
    }
    transaction.commit().await?;
    Ok(saved)
}
