//! Validated context rechecked before and after private media copies.
use super::{answer_access, gate, matching};
use crate::{
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use serde_json::{Map, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub struct Context {
    pub request: Uuid,
    pub record: Uuid,
    pub version: i64,
}
impl Context {
    pub async fn check(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        user: &UserRow,
        facts: &Map<String, Value>,
    ) -> ApiResult<()> {
        gate::company_open(tx, &user.workspace_id).await?;
        gate::joined(tx, user.id).await?;
        let row = answer_access::request(tx, self.request).await?;
        if row.workspace_id == user.workspace_id || row.version != self.version {
            return Err(ApiError::conflict("This request changed. Review it again."));
        }
        if matching::checklist(&row, facts)["matches"] != true {
            return Err(ApiError::conflict(
                "This property does not match the request.",
            ));
        }
        if answer_access::active_count(tx, self.request).await? >= 3 {
            return Err(ApiError::conflict(
                "This request already has three active offers.",
            ));
        }
        let duplicate:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM marketplace.crm_market_answers WHERE request_id=$1 AND ((workspace_id=$2 AND source_record_id=$3) OR (member_id=$4 AND state IN ('waiting','chosen'))))")
            .bind(self.request).bind(&user.workspace_id).bind(self.record).bind(user.id).fetch_one(&mut **tx).await?;
        if duplicate {
            return Err(ApiError::conflict(
                "You already offered a property for this request.",
            ));
        }
        Ok(())
    }
    pub async fn insert(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        user: &UserRow,
        share: Uuid,
        facts: &Map<String, Value>,
    ) -> ApiResult<()> {
        let slot:i16=sqlx::query_scalar("SELECT n::smallint FROM generate_series(1,3) n WHERE NOT EXISTS(SELECT 1 FROM marketplace.crm_market_answers WHERE request_id=$1 AND slot=n AND state IN ('waiting','chosen')) ORDER BY n LIMIT 1")
            .bind(self.request).fetch_optional(&mut **tx).await?.ok_or_else(||ApiError::conflict("This request is full."))?;
        let request = super::requests::load(tx, self.request)
            .await?
            .ok_or_else(ApiError::missing)?;
        let checklist = matching::checklist(&request, facts);
        sqlx::query("INSERT INTO marketplace.crm_market_answers(id,request_id,workspace_id,member_id,source_record_id,share_id,slot,checklist) VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
            .bind(Uuid::new_v4()).bind(self.request).bind(&user.workspace_id).bind(user.id).bind(self.record).bind(share).bind(slot).bind(checklist).execute(&mut **tx).await?;
        super::events::append(tx, &user.workspace_id, user.id, user.id, "answer_sent").await?;
        Ok(())
    }
}
