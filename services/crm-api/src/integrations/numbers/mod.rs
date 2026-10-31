//! Members' WhatsApp numbers (packet W1a, docs/whatsapp-design.md §3, §4 and §16) under
//! `/api/crm/workspaces/{ws}/whatsapp-numbers`. The owning Admin gives each member with the
//! WhatsApp grant their own number from the company Twilio account's online senders
//! (WQ3); the account phone is never proof (W-H1). The Admin may disconnect any number,
//! a member their own. The Super Admin holds no company number and reads none.
mod disconnect;
mod give;
mod senders;
pub mod store;
pub mod write;

pub use disconnect::disconnect;
pub use give::give;
pub use senders::list as senders;

use crate::{
    auth::{profile::UserRow, session::Session},
    error::ApiResult,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};

/// Who may hold a number: the company's Admin, or its staff with the WhatsApp grant.
pub fn may_have(user: &UserRow, workspace: &str) -> bool {
    user.workspace_id == workspace
        && user.role != "super-admin"
        && (user.role == "admin" || user.channel_access.0.whatsapp)
}

/// `GET /whatsapp-numbers`: the owning Admin sees the company's active numbers; staff see
/// only their own.
pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    super::mailbox::ensure(&state, &session, None, &workspace).await?;
    let only = (session.user.role != "admin").then_some(session.user.id);
    let mut tx = state.pool.begin().await?;
    let rows = store::active(&mut tx, &workspace, only).await?;
    tx.commit().await?;
    let numbers: Vec<Value> = rows.iter().map(store::NumberRow::view).collect();
    Ok(Json(json!({ "numbers": numbers })))
}
