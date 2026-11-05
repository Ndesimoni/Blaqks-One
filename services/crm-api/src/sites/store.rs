use super::{
    access,
    model::{SiteInput, SiteRow, COLUMNS},
    validation,
};
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn event(
    tx: &mut Transaction<'_, Postgres>,
    site: &SiteRow,
    actor: Uuid,
    action: &str,
) -> ApiResult<()> {
    sqlx::query("INSERT INTO sites.crm_website_site_events(id,site,workspace,actor,action,version) VALUES($1,$2,$3,$4,$5,$6)")
        .bind(Uuid::new_v4()).bind(site.id).bind(&site.workspace).bind(actor).bind(action).bind(site.version).execute(&mut **tx).await?;
    Ok(())
}
pub async fn save(
    tx: &mut Transaction<'_, Postgres>,
    workspace: Option<&str>,
    actor: Uuid,
    input: &SiteInput,
) -> ApiResult<SiteRow> {
    validation::site(input)?;
    let previous:Option<SiteRow>=sqlx::query_as(&format!("SELECT {COLUMNS} FROM sites.crm_website_sites WHERE workspace IS NOT DISTINCT FROM $1 FOR UPDATE"))
        .bind(workspace).fetch_optional(&mut **tx).await?;
    let id = previous.as_ref().map_or_else(Uuid::new_v4, |r| r.id);
    if previous.as_ref().map_or(0, |r| r.version) != input.version {
        return Err(ApiError::stale(
            "The website has changed. Reload and try again.",
        ));
    }
    let host = if let Some(workspace) = workspace {
        if input.host.is_some() {
            return Err(ApiError::invalid(
                "Company domains require trusted verification.",
            ));
        }
        if let Some(previous) = &previous {
            previous.host.clone()
        } else {
            let slug = input
                .slug
                .as_deref()
                .ok_or_else(|| ApiError::invalid("Choose a website slug."))?;
            if slug.len() > 40
                || slug.len() < 3
                || !slug
                    .bytes()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
                || [
                    "www", "api", "app", "crm", "admin", "mail", "help", "status",
                ]
                .contains(&slug)
            {
                return Err(ApiError::invalid(
                    "Choose an available lowercase website slug.",
                ));
            }
            let platform: String = sqlx::query_scalar(
                "SELECT host FROM sites.crm_website_sites WHERE kind='platform' AND active",
            )
            .fetch_optional(&mut **tx)
            .await?
            .ok_or_else(|| ApiError::conflict("The platform website is not configured."))?;
            let _ = workspace;
            format!("{slug}.{platform}")
        }
    } else {
        validation::host(
            input
                .host
                .as_deref()
                .ok_or_else(|| ApiError::invalid("Enter the platform hostname."))?,
        )?
    };
    let company = if workspace.is_some() {
        validation::company(input.company.as_ref(), &input.name)?
    } else {
        json!({})
    };
    let row:SiteRow=sqlx::query_as(&format!("INSERT INTO sites.crm_website_sites(id,workspace,kind,host,name,theme,active,entitled,company,content) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET host=EXCLUDED.host,name=EXCLUDED.name,theme=EXCLUDED.theme,active=EXCLUDED.active,company=EXCLUDED.company,content=EXCLUDED.content,version=sites.crm_website_sites.version+1,updated_at=now() RETURNING {COLUMNS}"))
        .bind(id).bind(workspace).bind(if workspace.is_some(){"company"}else{"platform"}).bind(host).bind(&input.name).bind(&input.theme).bind(input.active).bind(workspace.is_none()).bind(company).bind(if input.content.is_null(){json!({})}else{input.content.clone()}).fetch_one(&mut **tx).await?;
    sqlx::query("INSERT INTO sites.crm_website_content_versions(id,site,actor,version,body) VALUES($1,$2,$3,$4,$5)")
        .bind(Uuid::new_v4()).bind(row.id).bind(actor).bind(row.version).bind(json!({"company":row.company,"content":row.content,"name":row.name,"theme":row.theme})).execute(&mut **tx).await?;
    event(tx, &row, actor, "content_published").await?;
    Ok(row)
}
pub async fn company_dto(tx: &mut Transaction<'_, Postgres>, row: &SiteRow) -> ApiResult<Value> {
    if let Some(workspace) = &row.workspace {
        if !access::live_company(tx, workspace).await? {
            return Err(ApiError::missing());
        }
    }
    let mut company = row.company.clone();
    company["id"] = json!(row.id);
    Ok(company)
}

pub async fn profile_version(
    tx: &mut Transaction<'_, Postgres>,
    profile: &super::model::ProfileRow,
    actor: Uuid,
    action: &str,
) -> ApiResult<()> {
    let body = json!({"body":profile.body,"consent":profile.consent,"active":profile.active,"canPublish":profile.can_publish,"action":action});
    sqlx::query("INSERT INTO sites.crm_website_content_versions(id,profile,actor,version,body) VALUES($1,$2,$3,$4,$5)")
        .bind(Uuid::new_v4()).bind(profile.id).bind(actor).bind(profile.version).bind(body).execute(&mut **tx).await?;
    Ok(())
}
