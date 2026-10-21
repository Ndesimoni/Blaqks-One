//! One verified incoming mail → at most one Inbox event (E3c, design §6). Mail counts only
//! when an envelope recipient is on the company domain exactly (review L1); its local part
//! names the member when it is their active address, otherwise the mail follows normal
//! routing. Reports, the company's own mail and mail SendGrid scores as spam never start a
//! conversation. One post is one conversation, whatever the number of recipients.
use super::{super::addresses::lookup, inbound::Mail};
use crate::{
    error::ApiResult,
    integrations::webhooks::{
        inbound::Event,
        message::{EmailMeta, Inbound},
    },
};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

fn hashed(parts: &[&str]) -> String {
    let digest = Sha256::digest(parts.join("\n").as_bytes());
    let hex: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("sg:{}", &hex[..40])
}

pub async fn event(
    pool: &PgPool,
    workspace: &str,
    connection: Uuid,
    domain: &str,
    mail: Mail,
) -> ApiResult<Option<Event>> {
    let from_domain = mail.from.rsplit('@').next().unwrap_or_default();
    let recipients: Vec<&str> = mail
        .recipients
        .iter()
        .filter_map(|to| to.rsplit_once('@'))
        .filter(|(_, at)| *at == domain)
        .map(|(local, _)| local)
        .collect();
    if mail.report || from_domain == domain || recipients.is_empty() {
        return Ok(None);
    }
    let mut tx = pool.begin().await?;
    let mut owner = None;
    for local in &recipients {
        owner = lookup::member_for(&mut tx, workspace, domain, local).await?;
        if owner.is_some() {
            break;
        }
    }
    tx.commit().await?;
    let body_key = hashed(&[
        &mail.from,
        mail.subject.as_deref().unwrap_or(""),
        &mail.text,
    ]);
    let rfc = mail.message_id.clone();
    let key = rfc.as_deref().unwrap_or(&body_key);
    let thread_id = rfc
        .clone()
        .filter(|id| id.len() <= 200)
        .unwrap_or_else(|| hashed(&[key]));
    Ok(Some(Event {
        receipt_id: Uuid::new_v4(),
        workspace_id: workspace.to_owned(),
        connection_id: connection,
        channel: "email".into(),
        message: Inbound {
            thread_id,
            message_id: hashed(&[&connection.to_string(), key]),
            from: mail.from,
            name: mail.name,
            text: mail.text,
            has_media: mail.has_media,
            source: None,
            listing: None,
            email: Some(EmailMeta {
                subject: mail.subject,
                rfc_message_id: rfc,
                bounce: false,
                owner,
                // Spam may only join a conversation the CRM already holds.
                verified: mail.verified && !mail.spam,
                company: true,
                references: mail.references,
            }),
        },
    }))
}
