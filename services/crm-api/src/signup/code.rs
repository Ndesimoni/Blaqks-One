use crate::auth::{protection, session};
use rand::{rngs::OsRng, Rng};

pub fn generate() -> String {
    format!("{:06}", OsRng.gen_range(0..1_000_000u32))
}

pub fn digest(ticket: &str, code: &str) -> String {
    session::digest(&format!("{ticket}:{code}"))
}

pub fn matches(ticket: &str, code: &str, expected: &str) -> bool {
    let supplied = digest(ticket, code);
    protection::constant_time_equal(supplied.as_bytes(), expected.as_bytes())
}

pub fn valid(value: &str) -> bool {
    value.len() == 6 && value.bytes().all(|byte| byte.is_ascii_digit())
}

pub fn mask(email: &str) -> String {
    let (local, host) = email.split_once('@').unwrap_or(("", ""));
    let first = local.chars().next().unwrap_or('•');
    format!("{first}•••@{host}")
}
