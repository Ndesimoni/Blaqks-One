//! Route handlers for payment and expense decisions; each forwards to
//! [`approval::decide`] with a closed kind and verdict.
use super::{approval::decide, approval_rules::Verdict, entry::Kind};
use crate::{auth::session::Session, error::ApiResult, state::AppState};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::Value;

macro_rules! decision {
    ($name:ident, $kind:ident, $verdict:ident) => {
        pub async fn $name(
            State(state): State<AppState>,
            session: Session,
            headers: HeaderMap,
            Path(path): Path<(String, String)>,
            body: Result<Json<Value>, JsonRejection>,
        ) -> ApiResult<Json<Value>> {
            decide(
                Kind::$kind,
                Verdict::$verdict,
                state,
                session,
                headers,
                path,
                body,
            )
            .await
        }
    };
}

decision!(approve_payment, Payment, Approve);
decision!(reject_payment, Payment, Reject);
decision!(void_payment, Payment, Void);
decision!(approve_expense, Expense, Approve);
decision!(reject_expense, Expense, Reject);
decision!(void_expense, Expense, Void);
