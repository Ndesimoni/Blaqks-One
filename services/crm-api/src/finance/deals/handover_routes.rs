//! `POST /finance/handovers/{id}/accept {agreementVersion}`, `/decline`, `/cancel` (no
//! body) and `/approve {referralShareBp|null, reason, agreementVersion}` (Admin, may adjust
//! the referral within the same kind). `agreementVersion` is the version of the hand-over's
//! agreement the decider was shown (agreements design §14); hand-overs without an agreement
//! accept no body and take `null`.
use super::{
    gate::{self, Need},
    handover_decide::decide,
    handover_store::Decision,
    split::nullable_bp,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    finance::wire,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::Value;

const INVALID: &str = "Provide a referral share or null, a reason and the agreement version.";
const VERSION: &str = "Provide the agreement version you were shown, or null.";

/// `null` or a positive version.
fn version(value: &Value) -> ApiResult<Option<i64>> {
    match value {
        Value::Null => Ok(None),
        other => gate::version(other).map(Some),
    }
}

async fn simple(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    decision: Decision,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &path.0, Need::Module).await?;
    decide(state, session, path, (decision, None), None).await
}

pub async fn accept(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &path.0, Need::Module).await?;
    let seen = match body {
        Ok(Json(body)) => {
            let body = wire::exact(body, &["agreementVersion"], VERSION)?;
            version(&body["agreementVersion"])?
        }
        Err(JsonRejection::MissingJsonContentType(_)) => None,
        Err(_) => return Err(ApiError::invalid(VERSION)),
    };
    decide(state, session, path, (Decision::Accept, seen), None).await
}

pub async fn decline(
    state: State<AppState>,
    session: Session,
    headers: HeaderMap,
    path: Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    simple(state, session, headers, path, Decision::Decline).await
}

pub async fn cancel(
    state: State<AppState>,
    session: Session,
    headers: HeaderMap,
    path: Path<(String, String)>,
) -> ApiResult<Json<Value>> {
    simple(state, session, headers, path, Decision::Cancel).await
}

pub async fn approve(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &path.0, Need::Manage).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let keys = ["referralShareBp", "reason", "agreementVersion"];
    let body = wire::exact(body, &keys, INVALID)?;
    let referral = nullable_bp(&body["referralShareBp"])?.filter(|share| *share > 0);
    let reason = gate::reason(&body["reason"])?;
    let seen = version(&body["agreementVersion"])?;
    let decision = (Decision::Approve, seen);
    decide(state, session, path, decision, Some((referral, reason))).await
}
