use super::create::InviteRequest;
use crate::team::{access, audit};
use crate::{
    auth::{actions::Actions, permissions::Permissions, session},
    error::{ApiError, ApiResult},
    workspaces,
};
use sqlx::PgPool;
use uuid::Uuid;

pub struct Created {
    pub id: Uuid,
    pub token: String,
    pub expires_at: String,
}

pub async fn create(
    pool: &PgPool,
    actor: Uuid,
    owner: Uuid,
    workspace: &str,
    request: &InviteRequest,
    permissions: &Permissions,
    actions: Option<&Actions>,
) -> ApiResult<Created> {
    let id = Uuid::new_v4();
    let token = session::random_token();
    let role = request.account_role.as_deref().unwrap_or("staff");
    // Role allowlist (L-4): staff join the team; Admins get their own workspace.
    let staff = match role {
        "staff" => true,
        "admin" => false,
        _ => return Err(ApiError::forbidden()),
    };
    let mut transaction = pool.begin().await?;
    workspaces::lock(&mut transaction, workspace).await?;
    access::lock_owner(&mut transaction, owner).await?;
    sqlx::query(
        "INSERT INTO crm_users (id,name,email,phone,password_hash,role,active,owner_id,workspace_id, \
         positions,permissions,channel_access,accepted_at,actions) \
         VALUES ($1,$2,$3,$4,'',$5,false,$6,$7,$8,$9,$10,NULL,COALESCE($11,'{}'::jsonb))",
    ).bind(id).bind(&request.name).bind(&request.email).bind(&request.phone).bind(role)
        .bind(staff.then_some(owner)).bind(staff.then_some(workspace))
        .bind(sqlx::types::Json(&request.positions)).bind(sqlx::types::Json(permissions))
        .bind(sqlx::types::Json(request.channel_access.clone().unwrap_or_default()))
        .bind(actions.filter(|_| staff).map(sqlx::types::Json))
        .execute(&mut *transaction).await?;
    if !staff {
        workspaces::create(&mut transaction, &id.to_string(), id).await?;
    }
    let expires_at: String = sqlx::query_scalar(
        "INSERT INTO crm_team_invitations (token_hash,user_id,owner_id,workspace_id,created_by) \
         VALUES ($1,$2,$3,$4,$5) RETURNING \
         to_char(expires_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')",
    )
    .bind(session::digest(&token))
    .bind(id)
    .bind(owner)
    .bind(workspace)
    .bind(actor)
    .fetch_one(&mut *transaction)
    .await?;
    audit::append(&mut transaction, actor, workspace, id, "invited").await?;
    transaction.commit().await?;
    Ok(Created {
        id,
        token,
        expires_at,
    })
}
