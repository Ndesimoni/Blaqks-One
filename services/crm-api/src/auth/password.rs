use crate::error::{ApiError, ApiResult};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm, Argon2, Params, Version,
};
use rand::rngs::OsRng;

fn algorithm() -> Argon2<'static> {
    Argon2::new(
        Algorithm::Argon2id,
        Version::V0x13,
        Params::new(19 * 1024, 2, 1, None).expect("valid Argon2 parameters"),
    )
}

pub async fn hash(password: String) -> ApiResult<String> {
    tokio::task::spawn_blocking(move || {
        let salt = SaltString::generate(&mut OsRng);
        algorithm()
            .hash_password(password.as_bytes(), &salt)
            .map(|hash| hash.to_string())
            .map_err(|_| ApiError::invalid("Password hashing failed."))
    })
    .await
    .map_err(|_| ApiError::invalid("Password hashing failed."))?
}

pub async fn verify(password: String, hash: String) -> ApiResult<bool> {
    tokio::task::spawn_blocking(move || {
        PasswordHash::new(&hash)
            .map(|parsed| {
                algorithm()
                    .verify_password(password.as_bytes(), &parsed)
                    .is_ok()
            })
            .unwrap_or(false)
    })
    .await
    .map_err(|_| ApiError::invalid("Password verification failed."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn hashes_are_salted_and_verify_only_correct_password() {
        let value = "test1234".to_string();
        let first = hash(value.clone()).await.unwrap();
        let second = hash(value.clone()).await.unwrap();
        assert_ne!(first, second);
        assert!(first.starts_with("$argon2id$v=19$m=19456,t=2,p=1$"));
        assert!(verify(value, first.clone()).await.unwrap());
        assert!(!verify("incorrect".into(), first).await.unwrap());
    }
}
