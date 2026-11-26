use super::model::PublishInput;
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
    records::publication_source::{self, Source},
    sites::{self, ProfileRow, SiteRow},
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub struct Prepared {
    pub live: UserRow,
    pub profile: ProfileRow,
    pub company: SiteRow,
    pub source: Source,
}
pub async fn read(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    actor: Uuid,
    input: &PublishInput,
) -> ApiResult<Prepared> {
    let live = sites::access::member(tx, workspace, actor).await?;
    let profile=sites::read::usable_profile(tx,input.agent_profile_id).await?.ok_or_else(||ApiError::denied("The representative needs an active consented public profile and publication permission."))?;
    if profile.workspace != workspace || (live.role != "admin" && profile.member != actor) {
        return Err(ApiError::forbidden());
    }
    let company = sites::read::company(tx, workspace)
        .await?
        .ok_or_else(|| ApiError::conflict("Set up company publication details first."))?;
    if !company.licence_verified {
        return Err(ApiError::denied(
            "Company listing eligibility must be verified before publication.",
        ));
    }
    if input.destination == "company_only" && (!company.active || !company.entitled) {
        return Err(ApiError::conflict(
            "Company-only publication requires an active company website.",
        ));
    }
    let agent = sites::access::live_profile_member(tx, workspace, profile.member)
        .await?
        .ok_or_else(ApiError::missing)?;
    let source = publication_source::read(
        tx,
        workspace,
        &live,
        &agent,
        input.record_id,
        input.record_version,
    )
    .await?;
    let selected: Vec<_> = input.photos.iter().chain(&input.floor_plans).collect();
    if selected.iter().any(|id| !source.media.contains(id)) {
        return Err(ApiError::invalid(
            "Select public media from this property's stored gallery.",
        ));
    }
    Ok(Prepared {
        live,
        profile,
        company,
        source,
    })
}
