//! Steps 5, 7 and 9 of the canonical check order (contract §4, §5).
use super::{
    collections::Links,
    validation::ValidatedRecord,
    visibility::{predicate, RecordScope, CHILDREN, PARENTS},
};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

const IDS_FIXED: &str = "Record IDs cannot be changed.";

/// The locked, visible row an update or delete acts on.
#[derive(FromRow)]
pub struct Target {
    pub id: Uuid,
    pub version: i64,
    pub legacy_id: String,
    pub assignee_id: Option<Uuid>,
    pub contact_id: Option<String>,
    pub client_ref: Option<String>,
    pub property_ref: Option<String>,
    pub referral_ref: Option<String>,
    pub deal_ref: Option<String>,
    /// Whether the assigned-only caller holds the currently linked client.
    pub holds_client: bool,
}

impl Target {
    pub fn links(&self) -> Links {
        Links {
            contact: self.contact_id.clone(),
            client: self.client_ref.clone(),
            property: self.property_ref.clone(),
            referral: self.referral_ref.clone(),
            deal: self.deal_ref.clone(),
        }
    }
}

/// Step 5: one visibility-filtered query, so hidden, unknown and other-workspace IDs
/// all give the same 404. No version filter: step 6 compares it in Rust.
pub async fn fetch(
    transaction: &mut Transaction<'_, Postgres>,
    workspace: &str,
    collection: &str,
    id: Uuid,
    scope: RecordScope,
) -> ApiResult<Target> {
    let sql = format!(
        "SELECT r.id,r.version,r.legacy_id,r.assignee_id,r.contact_id,r.client_ref,\
         r.property_ref,r.referral_ref,r.deal_ref,EXISTS(SELECT 1 FROM crm_records c \
         WHERE c.workspace_id=$1 AND c.collection='Clients' AND c.legacy_id=r.client_ref \
         AND c.assignee_id=$4) AS holds_client \
         FROM crm_records r WHERE r.id=$3 AND r.workspace_id=$1 AND r.collection=$2 \
         AND {} FOR UPDATE OF r",
        predicate("r", "$1", "$4")
    );
    sqlx::query_as::<_, Target>(&sql)
        .bind(workspace)
        .bind(collection)
        .bind(id)
        .bind(scope.caller())
        .fetch_optional(&mut **transaction)
        .await?
        .ok_or_else(ApiError::missing)
}

/// Step 6.
pub fn ensure_version(target: &Target, version: i64, message: &'static str) -> ApiResult<()> {
    if target.version != version {
        return Err(ApiError::stale(message));
    }
    Ok(())
}

/// Step 7. Assigned-only callers cannot change IDs; team-scope callers may change a
/// parent's ID only when they can see every module that may reference it (M-C), so
/// a foreign-key refusal never reveals hidden records. A Follow-up's direct assignee
/// who does not hold its client may not move it to another client (H3).
pub fn ensure_update_allowed(
    user: &UserRow,
    collection: &str,
    target: &Target,
    record: &ValidatedRecord,
) -> ApiResult<()> {
    let renamed = record.legacy_id != target.legacy_id;
    let RecordScope::Assigned(caller) = RecordScope::of(user) else {
        if renamed && PARENTS.contains(&collection) && !user.covers_references(collection) {
            return Err(ApiError::invalid(IDS_FIXED));
        }
        return Ok(());
    };
    if renamed {
        return Err(ApiError::invalid(IDS_FIXED));
    }
    if collection == "Follow-ups"
        && target.assignee_id == Some(caller)
        && target.client_ref.is_some()
        && !target.holds_client
        && record.links.client != target.client_ref
    {
        return Err(ApiError::denied(
            "Only the client's holder can move this follow-up.",
        ));
    }
    Ok(())
}

/// Step 7 of a delete (§13 item 5): a direct assignee who does not hold the linked
/// client may complete or return a Follow-up, but not delete it. Runs after the
/// visibility-filtered fetch, so hidden and unknown IDs still get the identical 404.
pub fn ensure_delete_allowed(
    scope: RecordScope,
    collection: &str,
    target: &Target,
) -> ApiResult<()> {
    if let RecordScope::Assigned(caller) = scope {
        if collection == "Follow-ups"
            && target.assignee_id == Some(caller)
            && target.client_ref.is_some()
            && !target.holds_client
        {
            return Err(ApiError::denied(
                "Only the client's holder, the Admin or a full-team member can delete this \
                 follow-up.",
            ));
        }
    }
    Ok(())
}

/// Step 9: assigned-only child records need one of the caller's clients; only
/// Follow-ups may have none.
pub fn ensure_client(scope: RecordScope, collection: &str, links: &Links) -> ApiResult<()> {
    if !scope.is_team()
        && collection != "Follow-ups"
        && CHILDREN.contains(&collection)
        && links.client.is_none()
    {
        return Err(ApiError::invalid(
            "Choose one of your clients for this record.",
        ));
    }
    Ok(())
}
