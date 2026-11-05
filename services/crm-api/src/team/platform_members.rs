//! Blaqks One's view of one company's people on Companies (BO1a, design §2): name, email,
//! role, position names, status, last active and the version its controls need. Never
//! grants, records or record counts, and the company is never opened.
use super::positions::TABLE;
use crate::{
    auth::{session::Session, sessions},
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces::{
        self,
        platform::{Area, Level},
    },
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::{types::Json as Stored, FromRow, Postgres, Transaction};
use uuid::Uuid;

#[derive(FromRow)]
struct Row {
    id: Uuid,
    name: String,
    email: String,
    role: String,
    positions: Stored<Vec<String>>,
    active: bool,
    accepted: bool,
    revoked: bool,
    archived: bool,
    version: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformMember {
    id: Uuid,
    name: String,
    email: String,
    role: &'static str,
    role_id: String,
    positions: Vec<&'static str>,
    status: &'static str,
    last_active_at: Option<String>,
    version: i64,
}

impl From<Row> for PlatformMember {
    fn from(row: Row) -> Self {
        let status = if row.archived {
            "archived"
        } else if !row.accepted && !row.revoked {
            "pending"
        } else if row.active {
            "active"
        } else {
            "suspended"
        };
        let positions = row.positions.0.iter();
        Self {
            positions: positions.filter_map(|id| label(id)).collect(),
            role: if row.role == "admin" {
                "Admin"
            } else {
                "Staff"
            },
            status,
            last_active_at: None,
            id: row.id,
            name: row.name,
            email: row.email,
            role_id: row.role,
            version: row.version,
        }
    }
}

fn label(id: &str) -> Option<&'static str> {
    TABLE.iter().find(|row| row.0 == id).map(|row| row.1)
}

/// `GET /api/crm/platform/companies/{workspace}/members`: the company's Admin first, then its
/// staff by name, archived ones flagged. The live operator viewing companies only; any
/// company, archived included.
pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    let (companies, view) = (Area::Companies, Level::View);
    let allowed = workspaces::platform::areas::allows(&session.user, companies, view);
    if !allowed || workspace == workspaces::ORGANISATION {
        return Err(ApiError::forbidden());
    }
    let mut tx = state.pool.begin().await?;
    workspaces::platform::operator(&mut tx, session.user.id, companies, view).await?;
    let company: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM crm_workspaces w JOIN crm_users u ON u.id=w.owner_id \
         WHERE w.id=$1 AND u.role='admin')",
    )
    .bind(&workspace)
    .fetch_one(&mut *tx)
    .await?;
    if !company {
        return Err(ApiError::forbidden());
    }
    let members = rows(&mut tx, &workspace, None).await?;
    tx.commit().await?;
    Ok(Json(json!({ "members": members })))
}

/// The company's members (or the one named), with their last session use.
pub async fn rows(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    only: Option<Uuid>,
) -> ApiResult<Vec<PlatformMember>> {
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT id,name,email,role,positions,active,accepted,revoked,archived,version \
         FROM crm_member_profiles WHERE workspace_id=$1 AND role IN ('admin','staff') \
         AND ($2::uuid IS NULL OR id=$2) ORDER BY role<>'admin',name,id",
    )
    .bind(workspace)
    .bind(only)
    .fetch_all(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
    let seen = sessions::last_seen(tx, &ids).await?;
    Ok(rows
        .into_iter()
        .map(|row| {
            let at = seen
                .iter()
                .find(|(id, _)| *id == row.id)
                .map(|(_, at)| at.clone());
            PlatformMember {
                last_active_at: at,
                ..row.into()
            }
        })
        .collect())
}
