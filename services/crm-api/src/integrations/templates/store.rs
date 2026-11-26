//! SQL for `integrations.crm_provider_templates` (migration 0096). Every read is bound to the
//! workspace and the connection. A sync replaces the connection's set: listed templates are
//! written again, and when Twilio's list was read to its end the others are forgotten, so a
//! template whose approval changes or that is deleted leaves the composer at once.
use crate::{error::ApiResult, integrations::twilio::templates::Parsed};
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'a, 'b> = &'a mut Transaction<'b, Postgres>;

const SELECT: &str = "SELECT provider_template_id,name,language,category,approval,kind,body, \
    variable_count FROM integrations.crm_provider_templates";
/// Only these reach the composer (design §5 and §8).
const OFFERED: &str = "approval='approved' AND kind='text'";

#[derive(Clone, Debug, FromRow)]
pub struct Template {
    pub provider_template_id: String,
    pub name: String,
    pub language: String,
    pub category: Option<String>,
    pub approval: String,
    pub kind: String,
    pub body: Option<String>,
    pub variable_count: i16,
}

impl Template {
    pub fn offered(&self) -> bool {
        self.approval == "approved" && self.kind == "text" && self.body.is_some()
    }

    /// The Admin's list: every state, with whether the composer offers it.
    pub fn admin_view(&self) -> Value {
        let mut view = self.view();
        view["approval"] = json!(self.approval);
        view["kind"] = json!(self.kind);
        view["offered"] = json!(self.offered());
        view
    }

    /// What the composer shows.
    pub fn view(&self) -> Value {
        json!({
            "id": self.provider_template_id,
            "name": self.name,
            "language": self.language,
            "category": self.category,
            "body": self.body,
            "variables": self.variable_count,
        })
    }
}

pub async fn all(tx: Tx<'_, '_>, workspace: &str, connection: Uuid) -> ApiResult<Vec<Template>> {
    sqlx::query_as(&format!(
        "{SELECT} WHERE workspace_id=$1 AND connection_id=$2 ORDER BY lower(name),name,id"
    ))
    .bind(workspace)
    .bind(connection)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

pub async fn offered(
    tx: Tx<'_, '_>,
    workspace: &str,
    connection: Uuid,
) -> ApiResult<Vec<Template>> {
    sqlx::query_as(&format!(
        "{SELECT} WHERE workspace_id=$1 AND connection_id=$2 AND {OFFERED} \
         ORDER BY lower(name),name,id"
    ))
    .bind(workspace)
    .bind(connection)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

/// One offered template of the connection, or `None`.
pub async fn offered_one(
    tx: Tx<'_, '_>,
    workspace: &str,
    connection: Uuid,
    sid: &str,
) -> ApiResult<Option<Template>> {
    sqlx::query_as(&format!(
        "{SELECT} WHERE workspace_id=$1 AND connection_id=$2 AND provider_template_id=$3 \
         AND {OFFERED}"
    ))
    .bind(workspace)
    .bind(connection)
    .bind(sid)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

/// Writes the listed templates and, when `complete`, forgets every other one.
pub async fn replace(
    tx: Tx<'_, '_>,
    workspace: &str,
    connection: Uuid,
    listed: &[Parsed],
    complete: bool,
) -> ApiResult<()> {
    for parsed in listed {
        let (body, count) = match &parsed.text {
            Some((body, count)) => (Some(body.as_str()), *count),
            None => (None, 0),
        };
        sqlx::query(
            "INSERT INTO integrations.crm_provider_templates (id,workspace_id,connection_id, \
               provider_template_id,name,language,category,approval,kind,body,variable_count) \
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) \
             ON CONFLICT (connection_id,provider_template_id) DO UPDATE SET name=$5, \
               language=$6,category=$7,approval=$8,kind=$9,body=$10,variable_count=$11, \
               synced_at=now()",
        )
        .bind(Uuid::new_v4())
        .bind(workspace)
        .bind(connection)
        .bind(&parsed.sid)
        .bind(&parsed.name)
        .bind(&parsed.language)
        .bind(&parsed.category)
        .bind(parsed.approval)
        .bind(if body.is_some() { "text" } else { "other" })
        .bind(body)
        .bind(count)
        .execute(&mut **tx)
        .await?;
    }
    if complete {
        let kept: Vec<&str> = listed.iter().map(|parsed| parsed.sid.as_str()).collect();
        sqlx::query(
            "DELETE FROM integrations.crm_provider_templates \
             WHERE workspace_id=$1 AND connection_id=$2 AND NOT provider_template_id=ANY($3)",
        )
        .bind(workspace)
        .bind(connection)
        .bind(&kept)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}
