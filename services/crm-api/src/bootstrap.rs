use crate::{
    auth::{accounts, identity_rules, password, password_policy},
    error::{ApiError, ApiResult},
    workspaces::{self, ORGANISATION},
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

/// Reads a secret from `key`, a hidden terminal prompt or one line of piped input.
fn read_secret(key: &str, prompt: &str) -> ApiResult<String> {
    match env::var(key) {
        Ok(password) => Ok(password),
        Err(_) => prompt_secret(prompt),
    }
}

/// A hidden terminal prompt, or one line of piped input. Piped input that ends without
/// a line yields an empty string.
pub fn prompt_secret(prompt: &str) -> ApiResult<String> {
    let interactive = io::stdin().is_terminal();
    if interactive {
        eprint!("{prompt}");
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
    if identity_rules::identity(&name, &email, &phone).is_err()
        || !matches!(role.as_str(), "super-admin" | "admin")
    {
        return Err(ApiError::invalid(
            "Provide a valid name, email, international phone and admin role.",
        ));
    }
    let password = read_secret("CRM_BOOTSTRAP_PASSWORD", "New account password: ")?;
    // The new-password policy (account-self-service.md) applies to the command line too.
    password_policy::check(&password, None, &email)?;
    let hash = password::hash(password).await?;
    let mut transaction = pool.begin().await?;
    let id = if role == "admin" {
        accounts::create_admin(
            &mut transaction,
            accounts::NewAdmin {
                name: &name,
                email: &email,
                phone: &phone,
                password_hash: &hash,
                language: "en",
                email_verified: false,
            },
        )
        .await?
    } else {
        // The trusted CLI alone retains the explicit initial Super Admin path.
        let id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO crm_users (id,name,email,phone,password_hash,role) \
             VALUES ($1,$2,$3,$4,$5,'super-admin')",
        )
        .bind(id)
        .bind(name)
        .bind(email)
        .bind(phone)
        .bind(hash)
        .execute(&mut *transaction)
        .await?;
        id
    };
    let company = workspaces::company::NewCompany::OPERATOR_BROKERAGE;
    workspaces::create(&mut transaction, &id.to_string(), id, id, company).await?;
    if role == "super-admin" {
        workspaces::create(&mut transaction, ORGANISATION, id, id, company).await?;
    }
    transaction.commit().await?;
    Ok(id)
}
