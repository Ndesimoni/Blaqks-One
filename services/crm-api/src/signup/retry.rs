//! Bounded exponential backoff (packet R1). Transport errors, `429` and `5xx` retry with
//! jitter; a provider `Retry-After` wins up to the same cap. Permanent `4xx` never retries.
use std::time::Duration;

pub const MAX_ATTEMPTS: i32 = 8;
const CAP_SECS: u64 = 300;

/// 5s, 10s, 20s, … capped at 5 minutes, plus up to 999 ms of jitter.
pub fn backoff(attempts: i32, after: Option<Duration>, jitter_ms: u64) -> Duration {
    let exponent = (attempts.clamp(1, 7) - 1) as u32;
    let base = 5u64.saturating_mul(1u64 << exponent).min(CAP_SECS);
    let seconds = after
        .map(|value| value.as_secs())
        .unwrap_or(base)
        .min(CAP_SECS);
    Duration::from_secs(seconds) + Duration::from_millis(jitter_ms % 1_000)
}

#[cfg(test)]
#[path = "retry_tests.rs"]
mod tests;
