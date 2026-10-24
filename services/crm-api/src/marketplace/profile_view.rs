//! The two views of a stored profile (packet MK1b): the member's own choices, and the facts
//! another joined member may read. Never an email or a phone.
use super::profiles::Row;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Licence {
    pub number: String,
    pub authority: String,
}

/// The caller's own profile: the stored choices, never the member or company name.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Own {
    pub emirates: Vec<String>,
    pub communities: Vec<String>,
    pub property_types: Vec<String>,
    pub experience_years: i16,
    pub licence: Option<Licence>,
    pub joined_at: String,
    pub has_photo: bool,
    pub version: i64,
}

impl Row {
    pub fn own(&self) -> Own {
        Own {
            emirates: self.emirates.clone(),
            communities: self
                .communities
                .0
                .iter()
                .map(|entry| entry.name.clone())
                .collect(),
            property_types: self.property_types.clone(),
            experience_years: self.experience_years,
            licence: self.licence(),
            joined_at: self.joined_at.clone(),
            has_photo: self.photo_id.is_some(),
            version: self.version,
        }
    }

    pub fn licence(&self) -> Option<Licence> {
        Some(Licence {
            number: self.licence_number.clone()?,
            authority: self.licence_authority.clone()?,
        })
    }
}
