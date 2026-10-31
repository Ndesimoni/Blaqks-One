use super::input::Input;
use crate::{
    error::{ApiError, ApiResult},
    publications, sites, workspaces,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub struct Recipient {
    pub workspace: String,
    pub owner: Uuid,
    pub agent: Option<Uuid>,
    pub publication: Option<Uuid>,
    pub revision: Option<Uuid>,
    pub profile: Option<Uuid>,
}

pub async fn resolve(
    tx: &mut Transaction<'_, Postgres>,
    site: &sites::SiteRow,
    input: &Input,
) -> ApiResult<Recipient> {
    if let Some(listing) = input.listing_id {
        let found = publications::recipient(tx, site, listing).await?;
        if let Some(company) = input.company_id {
            let row = sites::read::public_company(tx, site, company).await?;
            if row.workspace.as_deref() != Some(&found.workspace) {
                return Err(ApiError::missing());
            }
        }
        if let Some(profile) = input.agent_id {
            let (workspace, member) = sites::profile_recipient(tx, site, profile).await?;
            if workspace != found.workspace || found.agent != Some(member) {
                return Err(ApiError::missing());
            }
        }
        return Ok(Recipient {
            workspace: found.workspace,
            owner: found.owner,
            agent: found.agent,
            publication: Some(found.publication),
            revision: Some(found.revision),
            profile: Some(found.profile),
        });
    }
    let (workspace, agent) = match input.agent_id {
        Some(profile) => {
            let (workspace, member) = sites::profile_recipient(tx, site, profile).await?;
            (workspace, Some(member))
        }
        None => (
            if let Some(company) = input.company_id {
                sites::read::public_company(tx, site, company)
                    .await?
                    .workspace
                    .ok_or_else(ApiError::missing)?
            } else {
                site.workspace.clone().ok_or_else(|| {
                    ApiError::invalid("Choose a property or representative for this enquiry.")
                })?
            },
            None,
        ),
    };
    if let Some(company) = input.company_id {
        let row = sites::read::public_company(tx, site, company).await?;
        if row.workspace.as_deref() != Some(&workspace) {
            return Err(ApiError::missing());
        }
    }
    if workspaces::frozen(tx, &workspace).await? {
        return Err(ApiError::missing());
    }
    let owner = workspaces::owner_of(tx, &workspace).await?;
    Ok(Recipient {
        workspace,
        owner,
        agent,
        publication: None,
        revision: None,
        profile: input.agent_id,
    })
}
