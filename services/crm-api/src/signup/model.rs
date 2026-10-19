use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StartRequest {
    pub name: String,
    pub email: String,
    pub phone: String,
    pub password: String,
    pub terms_version: String,
    pub privacy_version: String,
    pub language: String,
    pub bot_token: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartResponse {
    pub request_id: String,
    pub masked_email: String,
    pub expires_at: String,
    pub resend_after_seconds: i32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResendRequest {
    pub request_id: String,
    pub bot_token: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VerifyRequest {
    pub request_id: String,
    pub code: String,
}

#[derive(FromRow)]
pub struct Pending {
    pub email: String,
    pub existing_account: bool,
    pub name: String,
    pub phone: String,
    pub password_hash: String,
    pub language: String,
    pub terms_version: String,
    pub privacy_version: String,
    pub consented_at: String,
    pub code_hash: String,
    pub code_attempts: i32,
    pub total_attempts: i32,
}

pub struct Created {
    pub user: crate::auth::profile::UserRow,
    pub company: crate::workspaces::company::Company,
    pub session: crate::auth::sessions::Issued,
}
