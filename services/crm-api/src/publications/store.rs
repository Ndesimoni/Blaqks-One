use super::{
    capacity,
    model::{Publication, PublishInput, COLUMNS},
    prepare::Prepared,
    snapshot,
};
use crate::{
    error::{ApiError, ApiResult},
    media,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn publish(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    prepared: &Prepared,
    input: &PublishInput,
    copies: &[Uuid],
) -> ApiResult<Value> {
    let previous:Option<Publication>=sqlx::query_as(&format!("SELECT {COLUMNS} FROM publications.crm_website_listings WHERE workspace=$1 AND record=$2 AND member=$3 FOR UPDATE"))
        .bind(workspace).bind(input.record_id).bind(prepared.profile.member).fetch_optional(&mut **tx).await?;
    if previous.as_ref().map_or(0, |p| p.version) != input.version {
        return Err(ApiError::stale(
            "The public listing has changed. Reload and try again.",
        ));
    }
    let id = previous.as_ref().map_or_else(Uuid::new_v4, |p| p.id);
    let revision = Uuid::new_v4();
    let version = input.version + 1;
    capacity::ensure(
        tx,
        workspace,
        &prepared.source.physical_key,
        id,
        input.destination == "general_and_company",
    )
    .await?;
    let (photos, plans) = copies.split_at(input.photos.len());
    let snapshot = snapshot::build(prepared, input, id, photos, plans);
    sqlx::query("INSERT INTO publications.crm_website_listings(id,workspace,record,profile,member,physical_key,permit_reference,destination,version,source_version,snapshot,photos,floor_plans,revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(workspace,record,member) DO UPDATE SET profile=EXCLUDED.profile,physical_key=EXCLUDED.physical_key,permit_reference=EXCLUDED.permit_reference,destination=EXCLUDED.destination,active=true,version=EXCLUDED.version,source_version=EXCLUDED.source_version,snapshot=EXCLUDED.snapshot,photos=EXCLUDED.photos,floor_plans=EXCLUDED.floor_plans,revision=EXCLUDED.revision,published_at=now()")
        .bind(id).bind(workspace).bind(input.record_id).bind(prepared.profile.id).bind(prepared.profile.member).bind(&prepared.source.physical_key).bind(&input.permit_reference).bind(&input.destination).bind(version).bind(input.record_version).bind(&snapshot).bind(photos).bind(plans).bind(revision).execute(&mut **tx).await?;
    sqlx::query("INSERT INTO publications.crm_website_listing_revisions(id,publication,workspace,actor,version,source_version,snapshot,photos,floor_plans,action) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'publish')")
        .bind(revision).bind(id).bind(workspace).bind(prepared.live.id).bind(version).bind(input.record_version).bind(&snapshot).bind(photos).bind(plans).execute(&mut **tx).await?;
    media::public_assets::attach(tx, workspace, prepared.live.id, copies, revision).await?;
    crate::records::audit::append(
        tx,
        prepared.live.id,
        workspace,
        "updated",
        "Properties",
        input.record_id,
    )
    .await?;
    Ok(
        json!({"publication":{"id":id,"version":version,"sourceVersion":input.record_version,"state":"published","snapshot":snapshot["listing"]}}),
    )
}
