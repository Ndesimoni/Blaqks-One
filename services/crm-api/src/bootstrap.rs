use crate::{
    auth::password,
    error::{ApiError, ApiResult},
    workspaces::ORGANISATION,
};
use sqlx::PgPool;
use std::{
    env,
    io::{self, IsTerminal, Write},
};
use uuid::Uuid;

fn required(key: &str) -> ApiResult<String> {
    let value = env::var(key)
        .map_err(|_| ApiError::invalid("Bootstrap name, email, phone and role are required."))?;
    if value.trim().is_empty() {
        return Err(ApiError::invalid("Bootstrap fields cannot be empty."));
    }
    Ok(value.trim().to_owned())
}

fn read_password() -> ApiResult<String> {
    if let Ok(password) = env::var("CRM_BOOTSTRAP_PASSWORD") {
        return Ok(password);
    }
    let interactive = io::stdin().is_terminal();
    if interactive {
        eprint!("New account password: ");
        let _ = io::stderr().flush();
        if !std::process::Command::new("stty")
            .arg("-echo")
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
        {
            return Err(ApiError::invalid(
                "Use piped standard input for the password.",
            ));
        }
    }
    let mut password = String::new();
    let result = io::stdin().read_line(&mut password);
    if interactive {
        let _ = std::process::Command::new("stty").arg("echo").status();
        eprintln!();
    }
    result.map_err(|_| ApiError::invalid("Could not read password from standard input."))?;
    Ok(password.trim_end_matches(['\r', '\n']).to_owned())
}

pub async fn create_user(pool: &PgPool) -> ApiResult<Uuid> {
    let name = required("CRM_BOOTSTRAP_NAME")?;
    let email = required("CRM_BOOTSTRAP_EMAIL")?.to_lowercase();
    let phone = required("CRM_BOOTSTRAP_PHONE")?;
    let role = required("CRM_BOOTSTRAP_ROLE")?;
    let valid_email = email.split_once('@').is_some_and(|(local, host)| {
        !local.is_empty() && host.contains('.') && !host.contains('@')
    });
    if name.len() > 100
        || email.len() > 254
        || !valid_email
        || email.chars().any(char::is_whitespace)
        || !phone.starts_with('+')
        || !(8..=16).contains(&phone.len())
        || !phone[1..]
            .chars()
            .all(|character| character.is_ascii_digit())
        || !matches!(role.as_str(), "super-admin" | "admin")
    {
        return Err(ApiError::invalid(
            "Provide a valid name, email, international phone and admin role.",
        ));
    }
    let password = read_password()?;
    if !password::valid_length(&password) {
        return Err(ApiError::invalid(
            "Passwords must contain at least 8 characters and at most 1024 bytes.",
        ));
    }
    let hash = password::hash(password).await?;
    let id = Uuid::new_v4();
    let mut transaction = pool.begin().await?;
    sqlx::query(
        "INSERT INTO crm_users (id,name,email,phone,password_hash,role) VALUES ($1,$2,$3,$4,$5,$6)",
    )
    .bind(id)
    .bind(name)
    .bind(email)
    .bind(phone)
    .bind(hash)
    .bind(&role)
    .execute(&mut *transaction)
    .await?;
    sqlx::query("INSERT INTO crm_workspaces (id,owner_id) VALUES ($1,$2)")
        .bind(id.to_string())
        .bind(id)
        .execute(&mut *transaction)
        .await?;
    if role == "super-admin" {
        sqlx::query("INSERT INTO crm_workspaces (id,owner_id) VALUES ($1,$2)")
            .bind(ORGANISATION)
            .bind(id)
            .execute(&mut *transaction)
            .await?;
    }
    transaction.commit().await?;
    Ok(id)
}
