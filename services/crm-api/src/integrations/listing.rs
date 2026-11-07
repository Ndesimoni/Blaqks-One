//! `GET /channels`: this company's connections for the Channels screen, without
//! credentials. A SendGrid connection also says whether delivery updates and incoming mail
//! are set up (E3d), from the webhook keys the connection holds, and its domain in full.
use super::{access, store};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure_reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let rows = store::list(&mut tx, &workspace).await?;
    let webhooks: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT connection_id,kind FROM integrations.crm_sendgrid_webhooks WHERE workspace_id=$1",
    )
    .bind(&workspace)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let has = |id: Uuid, kind: &str| webhooks.iter().any(|(c, k)| *c == id && k == kind);
    let channels: Vec<Value> = rows
        .iter()
        .map(|row| {
            let mut view = row.view();
            if row.provider == "sendgrid" {
                // A company domain is public, and only the Admin reads this list.
                view["domain"] = json!(row.external_account_id);
                view["deliveryUpdates"] = json!(has(row.id, "events"));
                view["incomingMail"] = json!(has(row.id, "inbound"));
            }
            view
        })
        .collect();
    Ok(Json(json!({ "channels": channels })))
}
