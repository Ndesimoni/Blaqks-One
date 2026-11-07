use super::access;
use super::{
    access::Caller,
    create_checks::{self, Input, CHANGED},
    read, review, snapshot, snapshot_store, store,
};
use crate::{
    error::{ApiError, ApiResult},
    media::{copies::Reserved, copy_bytes},
    records::outside_facts,
    state::AppState,
};
use serde_json::Value;
use uuid::Uuid;
pub async fn finish(
    state: &AppState,
    actor: Uuid,
    workspace: &str,
    input: &Input,
    reserved: &[Reserved],
    market: Option<&crate::marketplace::answers_send::Context>,
) -> ApiResult<Value> {
    let mut tx = state.pool.begin().await?;
    let live = access::live(&mut tx, workspace, actor).await?;
    let outside = outside_facts::shareable(&mut tx, workspace, &live, input.record).await?;
    let marketplace_facts = outside.facts.clone();
    if let Some(context) = market {
        context.check(&mut tx, &live, &outside.facts).await?;
    }
    let draft = snapshot::draft(&mut tx, workspace, input.record, outside, input.exact).await?;
    let checked = review::sendable(&draft, input)?;
    create_checks::check(&mut tx, workspace, &live, input, true).await?;
    let snapshot: Uuid =
        match snapshot_store::existing(&mut tx, workspace, input.record, &draft.digest).await? {
            Some(made) => made,
            None => {
                let record = input.record;
                let mut copy = snapshot_store::reusable(&mut tx, workspace, record, &draft).await?;
                copy.extend(reserved.iter().map(|copy| (copy.source.id, copy.id)));
                let plan = draft.plan();
                if plan
                    .iter()
                    .any(|(source, _)| !copy.contains_key(&source.id))
                {
                    return Err(ApiError::conflict(CHANGED));
                }
                let fresh = copy_bytes::ids(reserved);
                let owner = (workspace, record, live.id);
                snapshot_store::insert(&mut tx, owner, &draft, (&copy, &fresh)).await?
            }
        };
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO agreements.crm_listing_shares (id,snapshot_id,workspace_id, \
         source_record_id,from_id,recipient_workspace_id,to_id,status,note,created_at, \
         offer_ends_at,view_ends_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,now(), \
         now() + interval '336 hours',$9::timestamptz)",
    )
    .bind(id)
    .bind(snapshot)
    .bind(workspace)
    .bind(input.record)
    .bind(live.id)
    .bind(&input.to_workspace)
    .bind(input.to)
    .bind(&input.note)
    .bind(&input.view_ends)
    .execute(&mut *tx)
    .await?;
    if let Some(context) = market {
        sqlx::query("UPDATE agreements.crm_listing_shares SET origin='marketplace' WHERE id=$1")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        context
            .insert(&mut tx, &live, id, &marketplace_facts)
            .await?;
    }
    store::event(
        &mut tx,
        id,
        "sent",
        Some((live.id, "sender")),
        (checked, None),
    )
    .await?;
    let row = store::find(&mut tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    let caller = Caller {
        id: live.id,
        workspace,
        admin: live.role == "admin",
    };
    let share = read::one_view(&mut tx, &row, &caller).await?;
    tx.commit().await?;
    Ok(share)
}
