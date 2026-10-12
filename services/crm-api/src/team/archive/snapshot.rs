use crate::team::members::{Member, MemberRow};
use crate::{
    auth::session,
    error::{ApiError, ApiResult},
};
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub member: Member,
    pub team_count: i64,
    pub record_count: i64,
    pub team_fingerprint: String,
}

pub async fn read(
    transaction: &mut Transaction<'_, Postgres>,
    id: Uuid,
    owner: Uuid,
    workspace: &str,
    manages_admin: bool,
) -> ApiResult<Snapshot> {
    let row = sqlx::query_as::<_, MemberRow>(
        "SELECT * FROM crm_member_profiles WHERE id=$1 AND NOT archived AND \
         ((role='staff' AND owner_id=$2 AND workspace_id=$3) OR ($4 AND role='admin'))",
    )
    .bind(id)
    .bind(owner)
    .bind(workspace)
    .bind(manages_admin)
    .fetch_optional(&mut **transaction)
    .await?
    .ok_or_else(ApiError::forbidden)?;
    let children: Vec<(Uuid, i64, bool)> =
        if row.user.role == "admin" {
            sqlx::query_as(
            "SELECT id,version,deleted_at IS NOT NULL FROM crm_users WHERE owner_id=$1 ORDER BY id",
        ).bind(id).fetch_all(&mut **transaction).await?
        } else {
            vec![]
        };
    let team_count = children.iter().filter(|(_, _, archived)| !archived).count() as i64;
    let team_fingerprint = fingerprint(&children);
    let record_count =
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM crm_records WHERE workspace_id=$1")
            .bind(&row.user.workspace_id)
            .fetch_one(&mut **transaction)
            .await?;
    Ok(Snapshot {
        member: row.into(),
        team_count,
        record_count,
        team_fingerprint,
    })
}

fn fingerprint(children: &[(Uuid, i64, bool)]) -> String {
    session::digest(&serde_json::to_string(children).expect("serializable membership snapshot"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn review_fingerprints_change_when_the_team_changes() {
        let id = Uuid::nil();
        assert_ne!(fingerprint(&[]), fingerprint(&[(id, 1, false)]));
        assert_ne!(
            fingerprint(&[(id, 1, false)]),
            fingerprint(&[(id, 2, false)])
        );
        assert_ne!(
            fingerprint(&[(id, 1, false)]),
            fingerprint(&[(id, 1, true)])
        );
        assert_eq!(fingerprint(&[]), fingerprint(&[]));
    }
}
