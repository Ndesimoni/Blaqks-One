use crate::team::{access, catalogue};
use crate::{
    auth::{
        profile::{Profile, UserRow},
        session::Session,
    },
    error::ApiResult,
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(FromRow)]
pub struct MemberRow {
    #[sqlx(flatten)]
    pub user: UserRow,
    pub active: bool,
    pub version: i64,
    pub accepted: bool,
    pub revoked: bool,
    pub archived: bool,
    pub archived_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    #[serde(flatten)]
    pub profile: Profile,
    pub active: bool,
    pub version: i64,
    pub invitation_pending: bool,
    pub archived: bool,
    pub deleted_at: Option<String>,
}

impl From<MemberRow> for Member {
    fn from(row: MemberRow) -> Self {
        let mut profile = Profile::from(row.user);
        profile.status = if row.archived {
            "archived"
        } else if !row.accepted && !row.revoked {
            "invited"
        } else if row.active {
            "active"
        } else {
            "inactive"
        }
        .into();
        Self {
            profile,
            active: row.active,
            version: row.version,
            invitation_pending: !row.accepted,
            archived: row.archived,
            deleted_at: row.archived_at,
        }
    }
}

pub async fn find(pool: &PgPool, id: Uuid) -> ApiResult<Member> {
    let row = sqlx::query_as::<_, MemberRow>("SELECT * FROM crm_member_profiles WHERE id=$1")
        .bind(id)
        .fetch_one(pool)
        .await?;
    Ok(row.into())
}

pub async fn list(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    Query(query): Query<TeamQuery>,
) -> ApiResult<Json<Value>> {
    if query.archived && session.user.role != "super-admin" {
        return Err(crate::error::ApiError::forbidden());
    }
    let owner = access::read_owner(&state, &session, &workspace).await?;
    let rows = sqlx::query_as::<_, MemberRow>(
        "SELECT * FROM crm_member_profiles \
         WHERE ((role='staff' AND owner_id=$1 AND workspace_id=$2) OR ($3 AND role='admin')) \
         AND archived=$4 \
         ORDER BY name,id",
    )
    .bind(owner)
    .bind(&workspace)
    .bind(access::can_manage_admin(&session, &workspace))
    .bind(query.archived)
    .fetch_all(&state.pool)
    .await?;
    let members: Vec<Member> = rows.into_iter().map(Into::into).collect();
    Ok(Json(
        json!({"members":members,"roles":catalogue::positions()}),
    ))
}

#[derive(Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct TeamQuery {
    archived: bool,
}
