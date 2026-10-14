//! `GET /finance` (finance-design §6.2): one REPEATABLE READ snapshot shaped per caller.
//! Settings, agreements, deals, hand-overs, payments, expenses, the statement and team
//! totals. Only approved payments and expenses count in any figure.
use super::{
    access,
    agreements::AgreementRow,
    deals::{handover_rows, list, totals, views::Viewer},
    entry_totals, expenses, payments, settings_store, statement,
};
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
    let agent = match &query.agent {
        Some(agent) => Some(
            Uuid::parse_str(agent)
                .map_err(|_| ApiError::invalid("Provide a valid finance filter."))?,
        ),
        None => None,
    };
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
    let user = &session.user;
    let viewer = Viewer::of(user);
    let loaded = list::load(&mut transaction, &workspace, user, agent, None).await?;
    let lines =
        statement::statement(&mut transaction, &workspace, agent.unwrap_or(user.id)).await?;
    let paid = payments::row::visible(&mut transaction, &workspace, user, agent, None).await?;
    let spent = expenses::row::visible(&mut transaction, &workspace, user, agent, None).await?;
    let properties = spent
        .iter()
        .filter_map(|e| e.property_ref.as_deref())
        .collect();
    let tx = &mut transaction;
    let references = totals::references(tx, &workspace, user, &loaded, properties).await?;
    let handovers = handover_rows::pending(&mut transaction, &workspace, &viewer).await?;
    transaction.commit().await?;
    let settings = settings.map(|row| {
        if team {
            row.team_view()
        } else {
            row.own_view()
        }
    });
    let my_agreements: Vec<Value> = mine.into_iter().map(AgreementRow::own_view).collect();
    let mut body = json!({
        "scope": if team { "team" } else { "own" },
        "settings": settings,
        "myAgreements": my_agreements,
        "deals": loaded.views(&viewer),
        "payments": paid.iter().map(|row| payments::views::view(row, &viewer)).collect::<Vec<_>>(),
        "expenses": spent.iter().map(|row| expenses::views::view(row, &viewer)).collect::<Vec<_>>(),
        "handovers": handovers,
        "statement": lines,
        "references": references,
    });
    if team {
        body["teamTotals"] = totals::team(&loaded);
        entry_totals::add(&mut body["teamTotals"], &paid, &spent);
    }
    Ok(Json(body))
}
