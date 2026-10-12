use crate::{
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::http::HeaderMap;

pub fn origin(state: &AppState, headers: &HeaderMap) -> ApiResult<()> {
    if headers.get("origin").and_then(|value| value.to_str().ok())
        != Some(state.config.origin.as_str())
    {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

pub fn mutation(state: &AppState, headers: &HeaderMap, expected: &str) -> ApiResult<()> {
    origin(state, headers)?;
    let supplied = headers
        .get("x-csrf-token")
        .and_then(|value| value.to_str().ok());
    if !supplied.is_some_and(|token| constant_time_equal(token.as_bytes(), expected.as_bytes())) {
        return Err(ApiError::forbidden());
    }
    Ok(())
}

fn constant_time_equal(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right)
        .fold(0u8, |difference, (a, b)| difference | (a ^ b))
        == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_require_complete_exact_match() {
        assert!(constant_time_equal(b"same-token", b"same-token"));
        assert!(!constant_time_equal(b"same-token", b"same-other"));
        assert!(!constant_time_equal(b"same-token", b"same-token-extra"));
    }
}
