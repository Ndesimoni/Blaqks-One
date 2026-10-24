//! The shapes a request's values may take (packet MK2): one of a fixed list, a community name
//! under the MK1 free-text rules (trimmed, inner spaces collapsed, lower-case key, no contact),
//! and a move-in month that exists. `request::validate` is the only caller.
use super::{
    free_text,
    profile::{Community, MAX_COMMUNITIES},
    request::{COMMUNITY, CONTACT, INVALID, MOVE_IN},
};
use crate::error::{ApiError, ApiResult};

/// One of a fixed list of choices, or a refusal.
pub fn listed(value: &str, allowed: &[&str]) -> ApiResult<String> {
    if allowed.contains(&value) {
        return Ok(value.to_owned());
    }
    Err(ApiError::invalid(INVALID))
}

/// A community name as the marketplace repeats it.
fn community(name: &str) -> ApiResult<Community> {
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if name.is_empty() || name.chars().count() > 60 || !free_text::plain(&name) {
        return Err(ApiError::invalid(COMMUNITY));
    }
    let key = name.to_lowercase();
    Ok(Community { name, key })
}

/// Up to twelve names, no repeats, and nothing that carries a phone number, an email or a link.
pub fn communities(names: &[String]) -> ApiResult<Vec<Community>> {
    if names.len() > MAX_COMMUNITIES {
        return Err(ApiError::invalid(INVALID));
    }
    let mut kept: Vec<Community> = Vec::new();
    for name in names {
        let entry = community(name)?;
        if kept.iter().any(|other| other.key == entry.key) {
            return Err(ApiError::invalid(COMMUNITY));
        }
        kept.push(entry);
    }
    let plain: Vec<&str> = kept.iter().map(|entry| entry.name.as_str()).collect();
    if free_text::carries_contact(&plain) {
        return Err(ApiError::invalid(CONTACT));
    }
    Ok(kept)
}

/// A month a client could move in: a real month from 2000 to 2100.
pub fn move_in(value: &str) -> ApiResult<String> {
    let valid = value.len() == 7
        && value.as_bytes()[4] == b'-'
        && value.char_indices().all(|(index, c)| match index {
            4 => c == '-',
            _ => c.is_ascii_digit(),
        });
    let year: u32 = value
        .get(..4)
        .and_then(|part| part.parse().ok())
        .unwrap_or(0);
    let month: u32 = value
        .get(5..)
        .and_then(|part| part.parse().ok())
        .unwrap_or(0);
    if !valid || !(2000..=2100).contains(&year) || !(1..=12).contains(&month) {
        return Err(ApiError::invalid(MOVE_IN));
    }
    Ok(value.to_owned())
}

#[cfg(test)]
#[path = "request_tests.rs"]
mod tests;
