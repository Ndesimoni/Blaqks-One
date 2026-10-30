use super::{
    access,
    model::{ProfileRow, SiteRow, COLUMNS},
    store,
};
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};

pub async fn catalogue(tx: &mut Transaction<'_, Postgres>, site: &SiteRow) -> ApiResult<Value> {
    let rows:Vec<SiteRow>=sqlx::query_as(&format!("SELECT {COLUMNS} FROM sites.crm_website_sites WHERE kind='company' AND licence_verified AND ($1::text IS NULL OR workspace=$1) ORDER BY id LIMIT 501"))
        .bind(&site.workspace).fetch_all(&mut **tx).await?;
    if rows.len() > 500 {
        return Err(ApiError::conflict("The public directory needs pagination."));
    }
    let mut companies = Vec::new();
    let mut agents = Vec::new();
    for row in rows {
        let Some(workspace) = &row.workspace else {
            continue;
        };
        if !access::live_company(tx, workspace).await? {
            continue;
        }
        companies.push(store::company_dto(tx, &row).await?);
        let profiles:Vec<ProfileRow>=sqlx::query_as("SELECT id,workspace,member,body,consent,can_publish,active,version FROM sites.crm_website_profiles WHERE workspace=$1 AND active AND consent ORDER BY id LIMIT 501")
            .bind(workspace).fetch_all(&mut **tx).await?;
        if profiles.len() + agents.len() > 500 {
            return Err(ApiError::conflict("The public directory needs pagination."));
        }
        for profile in profiles {
            let Some(member) = access::live_profile_member(tx, workspace, profile.member).await?
            else {
                continue;
            };
            if member.role != "admin" && !profile.can_publish {
                continue;
            }
            // An explicit public projection; links are re-checked as they are served (SOC1).
            let body = &profile.body;
            agents.push(json!({"id":profile.id,"company":row.id,"name":body["name"],
                "specialty":body["specialty"],"publicWhatsApp":body["publicWhatsApp"],
                "publicEmail":body["publicEmail"],
                "social":super::social::public(body.get("social"),site.workspace.is_none())}));
        }
    }
    Ok(json!({"companies":companies,"agents":agents,"areas":[],"developers":[],"listings":[]}))
}
