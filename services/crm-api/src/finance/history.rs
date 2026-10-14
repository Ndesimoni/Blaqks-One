//! `GET /finance/{deals|payments|expenses}/{id}/history` (finance-design §6.2, §5.3): the
//! append-only finance events of one visible row, oldest first. Team finance sees actors,
//! changes and reasons; the own view sees the timeline and the reasons of rejections.
//! Hidden, unknown and other-workspace IDs give the identical 404.
use super::{access, deals::gate, events::Entity};
use crate::{
    auth::{finance_access::FinanceScope, session::Session},
    error::{ApiError, ApiResult},
    records::visibility::{finance_predicate, FinanceTable},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use sqlx::{types::Json as Jsonb, FromRow};

#[derive(FromRow)]
struct EventRow {
    at: String,
    action: String,
    actor_id: uuid::Uuid,
    actor_name: String,
    changes: Jsonb<Value>,
    reason: Option<String>,
}

type Target = Path<(String, String)>;

pub async fn deal(
    state: State<AppState>,
    session: Session,
    path: Target,
) -> ApiResult<Json<Value>> {
    history(state, session, path, FinanceTable::Deals).await
}

pub async fn payment(
    state: State<AppState>,
    session: Session,
    path: Target,
) -> ApiResult<Json<Value>> {
    history(state, session, path, FinanceTable::Payments).await
}

pub async fn expense(
    state: State<AppState>,
    session: Session,
    path: Target,
) -> ApiResult<Json<Value>> {
    history(state, session, path, FinanceTable::Expenses).await
}

async fn history(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Target,
    table: FinanceTable,
) -> ApiResult<Json<Value>> {
    let team = access::reader(&state, &session, &workspace).await?.scope == FinanceScope::Team;
    let id = gate::id(&id)?;
    let (name, entity) = match table {
        FinanceTable::Deals => ("crm_deals", Entity::Deal),
        FinanceTable::Payments => ("crm_payments", Entity::Payment),
        FinanceTable::Expenses => ("crm_expenses", Entity::Expense),
    };
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let visible: bool = sqlx::query_scalar(&format!(
        "SELECT EXISTS(SELECT 1 FROM {name} x WHERE x.workspace_id=$1 AND x.id=$2 AND {})",
        finance_predicate(table, "x", "$1", "$3")
    ))
    .bind(&workspace)
    .bind(id)
    .bind(gate::caller(&session.user))
    .fetch_one(&mut *tx)
    .await?;
    if !visible {
        return Err(ApiError::missing());
    }
    let rows = sqlx::query_as::<_, EventRow>(
        "SELECT to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS at, \
         e.action,e.actor_id,u.name AS actor_name,e.changes,e.reason FROM crm_finance_events e \
         JOIN crm_users u ON u.id=e.actor_id WHERE e.workspace_id=$1 AND e.entity=$2 \
         AND e.entity_id=$3 ORDER BY e.created_at,e.id",
    )
    .bind(&workspace)
    .bind(entity.as_str())
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let history: Vec<Value> = rows.into_iter().map(|row| item(row, team)).collect();
    Ok(Json(json!({ "history": history })))
}

fn item(row: EventRow, team: bool) -> Value {
    if team {
        return json!({"at": row.at, "action": row.action,
            "actor": {"id": row.actor_id, "name": row.actor_name},
            "changes": row.changes.0, "reason": row.reason});
    }
    let mut value = json!({"at": row.at, "action": row.action,
        "actor": {"name": row.actor_name}});
    if row.action == "rejected" {
        value["reason"] = json!(row.reason);
    }
    value
}
