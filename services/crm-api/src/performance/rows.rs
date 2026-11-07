//! Target rows: the wire view and reads for one month or one target (locked for writes).
use super::input::{Metric, TargetInput};
use crate::error::ApiResult;
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

pub const COLUMNS: &str = "id,member_id,month,metric,value,version, \
    to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS updated_at";

#[derive(Clone, FromRow)]
pub struct TargetRow {
    pub id: Uuid,
    pub member_id: Option<Uuid>,
    pub month: String,
    pub metric: String,
    pub value: i64,
    pub version: i64,
    pub updated_at: String,
}

impl TargetRow {
    pub fn metric(&self) -> Option<Metric> {
        Metric::parse(&self.metric)
    }

    pub fn view(&self) -> Value {
        json!({"id": self.id, "memberId": self.member_id, "month": self.month,
            "metric": self.metric, "value": self.value, "version": self.version,
            "updatedAt": self.updated_at})
    }
}

pub async fn month(pool: &PgPool, workspace: &str, month: &str) -> ApiResult<Vec<TargetRow>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM crm_targets WHERE workspace_id=$1 AND month=$2 \
         ORDER BY member_id NULLS FIRST,metric"
    );
    Ok(sqlx::query_as::<_, TargetRow>(&sql)
        .bind(workspace)
        .bind(month)
        .fetch_all(pool)
        .await?)
}

pub async fn current(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    input: &TargetInput,
) -> ApiResult<Option<TargetRow>> {
    let sql = format!(
        "SELECT {COLUMNS} FROM crm_targets WHERE workspace_id=$1 AND member_id IS NOT DISTINCT \
         FROM $2 AND month=$3 AND metric=$4 FOR UPDATE"
    );
    Ok(sqlx::query_as::<_, TargetRow>(&sql)
        .bind(workspace)
        .bind(input.member)
        .bind(&input.month)
        .bind(input.metric.key())
        .fetch_optional(&mut **tx)
        .await?)
}
