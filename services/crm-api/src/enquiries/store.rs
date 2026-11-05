use super::{input::Input, recipient::Recipient};
use crate::{
    auth::{session::digest, throttle},
    error::{ApiError, ApiResult},
    records::mutation::Entry,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'a> = Transaction<'a, Postgres>;

pub async fn lock(tx: &mut Tx<'_>, site: Uuid, key: &str) -> ApiResult<()> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("website-enquiry:{site}:{key}"))
        .execute(&mut **tx)
        .await?;
    Ok(())
}

pub async fn previous(
    tx: &mut Tx<'_>,
    site: Uuid,
    key: &str,
    hash: &str,
) -> ApiResult<Option<Uuid>> {
    let found: Option<(Uuid,String)> = sqlx::query_as(
        "SELECT id,payload_hash FROM enquiries.crm_website_enquiries WHERE source_site=$1 AND key_hash=$2")
        .bind(site).bind(key).fetch_optional(&mut **tx).await?;
    match found {
        Some((receipt, prior)) if prior == hash => Ok(Some(receipt)),
        Some(_) => Err(ApiError::conflict(
            "This submission key was already used for another enquiry.",
        )),
        None => Ok(None),
    }
}

pub async fn budget(
    tx: &mut Tx<'_>,
    site: Uuid,
    client: &str,
    contacts: &[String],
) -> ApiResult<()> {
    const BUSY: &str = "Too many enquiries. Try again later.";
    let mut budgets = vec![
        (format!("website:site:{site}"), 100, 3600),
        (format!("website:client:{site}:{client}"), 10, 900),
    ];
    budgets.extend(contacts.iter().map(|contact| {
        (
            format!("website:contact:{site}:{}", digest(contact)),
            5,
            3600,
        )
    }));
    for (key, limit, seconds) in budgets {
        throttle::consume_window(&mut **tx, &key, limit, seconds, BUSY, "rate_limited").await?;
    }
    Ok(())
}

pub async fn save(
    tx: &mut Tx<'_>,
    site: &crate::sites::SiteRow,
    key: &str,
    hash: &str,
    input: &Input,
    recipient: &Recipient,
    lead: &Entry,
) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO enquiries.crm_website_enquiries \
        (id,source_site,source_host,key_hash,payload_hash,workspace_id,publication_id,public_profile_id,assignee_id,lead_id,payload,publication_revision,source_site_version) \
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)")
        .bind(id).bind(site.id).bind(&site.host).bind(key).bind(hash).bind(&recipient.workspace).bind(recipient.publication)
        .bind(recipient.profile).bind(lead.assignee).bind(lead.id).bind(serde_json::to_value(input).map_err(|_| ApiError::invalid("Invalid enquiry."))?)
        .bind(recipient.revision).bind(site.version)
        .execute(&mut **tx).await?;
    sqlx::query("INSERT INTO enquiries.crm_website_enquiry_events (id,enquiry_id,actor_id,action) VALUES ($1,$2,NULL,'received')")
        .bind(Uuid::new_v4()).bind(id).execute(&mut **tx).await?;
    Ok(id)
}
