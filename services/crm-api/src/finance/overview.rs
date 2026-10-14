//! `GET /finance` (finance-design §6.2): one REPEATABLE READ snapshot shaped per caller.
//! B2 serves the settings and agreement parts; deals, payments, expenses, statement and
//! team totals are empty until their packets (B3/B4) add the tables behind them.
use super::{access, agreements::AgreementRow, settings_store};
use crate::{
    auth::{finance_access::FinanceScope, session::Session},
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::QueryRejection, Path, Query, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OverviewQuery {
    agent: Option<String>,
}

pub async fn overview(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
    query: Result<Query<OverviewQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    let access = access::reader(&state, &session, &workspace).await?;
    let team = access.scope == FinanceScope::Team;
    let Query(query) = query.map_err(|_| ApiError::invalid("Provide a valid finance filter."))?;
    if query.agent.is_some() && !team {
        return Err(ApiError::forbidden());
    }
    if let Some(agent) = &query.agent {
        Uuid::parse_str(agent).map_err(|_| ApiError::invalid("Provide a valid finance filter."))?;
    }
    let mut transaction = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *transaction)
        .await?;
    let settings = settings_store::load(&mut transaction, &workspace, false).await?;
    let mine = sqlx::query_as::<_, AgreementRow>(
        "SELECT a.id,a.agent_id,u.name AS agent_name,a.agent_share_bp, \
         a.effective_from::text AS effective_from,a.effective_to::text AS effective_to \
         FROM crm_commission_agreements a JOIN crm_users u ON u.id=a.agent_id \
         WHERE a.workspace_id=$1 AND a.agent_id=$2 ORDER BY a.effective_from",
    )
    .bind(&workspace)
    .bind(session.user.id)
    .fetch_all(&mut *transaction)
    .await?;
    transaction.commit().await?;
    let settings = settings.map(|row| {
        if team {
            row.team_view()
        } else {
            row.own_view()
        }
    });
    let my_agreements: Vec<Value> = mine.into_iter().map(AgreementRow::own_view).collect();
    let zero = json!({"earnedFils": 0, "receivedShareFils": 0, "outstandingFils": 0});
    let mut body = json!({
        "scope": if team { "team" } else { "own" },
        "settings": settings,
        "myAgreements": my_agreements,
        "deals": [], "payments": [], "expenses": [],
        "statement": {"lines": [], "totals": zero},
        "references": {"Clients": [], "Properties": []},
    });
    if team {
        body["teamTotals"] = json!({"grossFils": 0, "partnerFils": 0, "netFils": 0,
            "companyFils": 0, "vatFils": 0, "receivedFils": 0, "outstandingFils": 0,
            "expensesApprovedFils": 0, "pendingCount": 0, "byAgent": []});
    }
    Ok(Json(body))
}
