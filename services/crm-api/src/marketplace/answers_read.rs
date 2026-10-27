//! Only a poster sees all offers; each answering broker sees their own offer only.
use super::{answer_access, gate, limits, matching, requests, visibility};
use crate::{
    agreements::listings,
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    Json,
};
use serde_json::{json, Value};
use uuid::Uuid;
pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    let user = gate::reader(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    gate::company_open(&mut tx, &workspace).await?;
    gate::joined(&mut tx, user.id).await?;
    let id = limits::missing_id(&id)?;
    let row = requests::load(&mut tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    if visibility::visible(&mut tx, row.member_id).await?.is_none() {
        return Err(ApiError::missing());
    }
    let poster = row.member_id == user.id;
    if !poster {
        if requests::state(&row) == "open" {
            answer_access::request(&mut tx, id).await?;
        } else {
            let participant:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM marketplace.crm_market_answers WHERE request_id=$1 AND member_id=$2) OR EXISTS(SELECT 1 FROM marketplace.crm_market_conversations WHERE request_id=$1 AND broker_id=$2)")
                .bind(id).bind(user.id).fetch_one(&mut *tx).await?;
            if !participant {
                return Err(ApiError::missing());
            }
        }
    }
    let active = answer_access::active_count(&mut tx, id).await?;
    let rows:Vec<(Uuid,Uuid,Uuid,String,Value)>=sqlx::query_as("SELECT id,member_id,share_id,state,checklist FROM marketplace.crm_market_answers WHERE request_id=$1 AND ($2 OR member_id=$3) ORDER BY created_at LIMIT 100")
        .bind(id).bind(poster).bind(user.id).fetch_all(&mut *tx).await?;
    let mut answers = Vec::new();
    for (id, member, share, state, checklist) in rows {
        let (agreement, release) = super::agreement_view::answer(&mut tx, share, &user).await?;
        let name = visibility::visible(&mut tx, member)
            .await?
            .map(|v| v.name)
            .unwrap_or_default();
        answers.push(json!({"id":id,"memberId":member,"name":name,"shareId":share,
            "state":state,"checklist":checklist,"agreement":agreement,"release":release,"listing":listings::marketplace::summary(&mut tx,share,&user).await?}));
    }
    let matches = if poster || requests::state(&row) != "open" {
        vec![]
    } else {
        matching::own_matches(&mut tx, &user, &row)
            .await?
            .into_iter()
            .map(|(id, checklist)| json!({"recordId":id,"checklist":checklist}))
            .collect()
    };
    let already_offered = answers.iter().any(|a| {
        a["memberId"] == json!(user.id) && matches!(a["state"].as_str(), Some("waiting" | "chosen"))
    });
    let can_offer = !already_offered
        && !poster
        && row.workspace_id != workspace
        && requests::state(&row) == "open"
        && active < 3
        && !matches.is_empty();
    let can_message = !poster
        && row.workspace_id != workspace
        && requests::state(&row) == "open"
        && active < 3
        && matches.is_empty();
    let draft = super::agreement_view::draft(&mut tx, row.id, &user).await?;
    let can_reopen = poster
        && requests::state(&row) == "paused"
        && !answers.iter().any(|answer| {
            matches!(
                answer["agreement"]["state"].as_str(),
                Some("accepted" | "completed")
            )
        });
    tx.commit().await?;
    Ok(Json(
        json!({"request":{"id":id,"state":requests::state(&row),"isPoster":poster,"version":row.version,"activeOffers":active,"canOffer":can_offer,"canMessage":can_message,"canReopen":can_reopen,"canProposeAgreement":!draft.is_null(),"agreementDraft":draft},"answers":answers,"matches":matches}),
    ))
}
