//! The member's marketplace profile (§2, review amendment 8): the emirates covered, up to
//! twelve communities (each with a normalised key for matching), property types, experience
//! and an optional licence. Free text may not carry a phone number, an email address or a link.
use super::free_text;
use crate::error::{ApiError, ApiResult};
use serde::{Deserialize, Serialize};

pub const INVALID: &str = "Provide valid marketplace profile details.";
pub const COMMUNITY: &str = "Community names use English letters, digits, spaces and ' - & only.";
pub const CONTACT: &str = "Remove phone numbers, email addresses and links.";
pub const LICENCE: &str = "Enter a licence number of letters and digits, up to 20.";
pub const EMIRATES: [&str; 7] = [
    "abu-dhabi",
    "dubai",
    "sharjah",
    "ajman",
    "umm-al-quwain",
    "ras-al-khaimah",
    "fujairah",
];
pub const TYPES: [&str; 4] = [
    "residential_sale",
    "residential_rent",
    "commercial_sale",
    "commercial_rent",
];
pub const AUTHORITIES: [&str; 3] = ["RERA", "ADREC", "other"];
pub const MAX_COMMUNITIES: usize = 12;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Community {
    pub name: String,
    pub key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Input {
    pub emirates: Vec<String>,
    #[serde(default)]
    pub communities: Vec<String>,
    pub property_types: Vec<String>,
    pub experience_years: i16,
    #[serde(default)]
    pub licence: Option<Licence>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Licence {
    pub number: String,
    pub authority: String,
}

/// The profile as the database stores it.
pub struct Valid {
    pub emirates: Vec<String>,
    pub communities: Vec<Community>,
    pub property_types: Vec<String>,
    pub experience_years: i16,
    pub licence_number: Option<String>,
    pub licence_authority: Option<String>,
}

fn listed(value: &[String], allowed: &[&str], least: usize) -> ApiResult<Vec<String>> {
    let mut seen = Vec::new();
    for item in value {
        if !allowed.contains(&item.as_str()) || seen.contains(item) {
            return Err(ApiError::invalid(INVALID));
        }
        seen.push(item.clone());
    }
    if seen.len() < least {
        return Err(ApiError::invalid(INVALID));
    }
    Ok(seen)
}

fn community(name: &str) -> ApiResult<Community> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 60 || !free_text::plain(name) {
        return Err(ApiError::invalid(COMMUNITY));
    }
    Ok(Community {
        name: name.to_owned(),
        key: name.to_lowercase(),
    })
}

pub fn validate(input: Input) -> ApiResult<Valid> {
    let emirates = listed(&input.emirates, &EMIRATES, 1)?;
    let property_types = listed(&input.property_types, &TYPES, 1)?;
    if !(0..=60).contains(&input.experience_years) || input.communities.len() > MAX_COMMUNITIES {
        return Err(ApiError::invalid(INVALID));
    }
    let mut communities = Vec::new();
    for name in &input.communities {
        let entry = community(name)?;
        if communities
            .iter()
            .any(|other: &Community| other.key == entry.key)
        {
            return Err(ApiError::invalid(COMMUNITY));
        }
        communities.push(entry);
    }
    let names: Vec<&str> = communities
        .iter()
        .map(|entry| entry.name.as_str())
        .collect();
    if free_text::carries_contact(&names) {
        return Err(ApiError::invalid(CONTACT));
    }
    let (licence_number, licence_authority) = match input.licence {
        None => (None, None),
        Some(licence) => {
            let number = licence.number.trim();
            let shape = !number.is_empty()
                && number.chars().count() <= 20
                && number.chars().all(|c| c.is_ascii_alphanumeric());
            if !shape || free_text::carries_contact(&[number]) {
                return Err(ApiError::invalid(LICENCE));
            }
            if !AUTHORITIES.contains(&licence.authority.as_str()) {
                return Err(ApiError::invalid(LICENCE));
            }
            (Some(number.to_owned()), Some(licence.authority))
        }
    };
    Ok(Valid {
        emirates,
        communities,
        property_types,
        experience_years: input.experience_years,
        licence_number,
        licence_authority,
    })
}
