//! A client's fields from a request, checked the same way on create and on edit: a company
//! or contact name, a phone (international form) or an email, names up to 120 characters,
//! notes up to 4000 and a follow-up day as YYYY-MM-DD. An edit names only what changes, and
//! `null` clears a field; the merged record is checked as a whole.
use super::{
    model,
    rules::{day, text},
};
use crate::{
    auth::identity_rules,
    error::{ApiError, ApiResult},
};
use serde::{Deserialize, Deserializer};
use uuid::Uuid;

pub const NAMED: &str = "Give a company or contact name.";
pub const REACHABLE: &str = "Give a phone number or an email.";
pub const COMPANY: &str = "Keep the company name to 160 characters.";
pub const NAME: &str = "Keep the contact name to 120 characters.";
pub const PHONE: &str = "Give the phone in international form, like +971501234567.";
pub const EMAIL: &str = "Give a valid email.";
pub const TEXT: &str = "Keep notes and entries to 4000 characters.";
pub const DATE: &str = "Give the follow-up day as YYYY-MM-DD.";

/// The create and edit body. An edit also carries the version it was made from.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Body {
    pub version: Option<i64>,
    #[serde(default, deserialize_with = "present")]
    pub company_name: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub contact_name: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub phone: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub email: Option<Option<String>>,
    pub source: Option<String>,
    pub stage: Option<String>,
    #[serde(default, deserialize_with = "present")]
    pub notes: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub next_follow_up: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    pub owner_id: Option<Option<Uuid>>,
}

/// A field the request names, even as `null`.
fn present<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    deserializer: D,
) -> Result<Option<Option<T>>, D::Error> {
    Option::<T>::deserialize(deserializer).map(Some)
}

/// Every editable field of a client, as stored.
#[derive(Clone, Debug, Default, PartialEq, Eq, sqlx::FromRow)]
pub struct Fields {
    pub company_name: Option<String>,
    pub contact_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub source: String,
    pub stage: String,
    pub notes: Option<String>,
    pub next_follow_up: Option<String>,
    pub owner_id: Option<Uuid>,
}

impl Fields {
    /// A new client: from another source and at New unless the request says otherwise.
    pub fn fresh() -> Self {
        Self {
            source: "other".into(),
            stage: "new".into(),
            ..Self::default()
        }
    }

    /// The fields the request names applied over these, then checked as a whole.
    pub fn apply(mut self, body: Body) -> ApiResult<Self> {
        let replace = |slot: &mut Option<String>, value: Option<Option<String>>| {
            if let Some(value) = value {
                *slot = value;
            }
        };
        replace(&mut self.company_name, body.company_name);
        replace(&mut self.contact_name, body.contact_name);
        replace(&mut self.phone, body.phone);
        replace(&mut self.email, body.email);
        replace(&mut self.notes, body.notes);
        replace(&mut self.next_follow_up, body.next_follow_up);
        if let Some(owner) = body.owner_id {
            self.owner_id = owner;
        }
        if let Some(source) = body.source {
            self.source = model::source(&source)
                .ok_or(ApiError::invalid(model::SOURCE))?
                .into();
        }
        if let Some(stage) = body.stage {
            self.stage = model::stage(&stage)
                .ok_or(ApiError::invalid(model::STAGE))?
                .into();
        }
        self.checked()
    }

    /// Trimmed, with empty text as no value, and every rule applied.
    pub fn checked(self) -> ApiResult<Self> {
        let company_name = text(self.company_name, 160, COMPANY)?;
        let contact_name = text(self.contact_name, 120, NAME)?;
        if company_name.is_none() && contact_name.is_none() {
            return Err(ApiError::invalid(NAMED));
        }
        let phone =
            text(self.phone, 32, PHONE)?.map(|value| value.replace([' ', '-', '(', ')'], ""));
        if phone
            .as_deref()
            .is_some_and(|value| !identity_rules::phone(value))
        {
            return Err(ApiError::invalid(PHONE));
        }
        let email = text(self.email, 254, EMAIL)?.map(|value| value.to_lowercase());
        if email
            .as_deref()
            .is_some_and(|value| !identity_rules::email(value))
        {
            return Err(ApiError::invalid(EMAIL));
        }
        if phone.is_none() && email.is_none() {
            return Err(ApiError::invalid(REACHABLE));
        }
        Ok(Self {
            company_name,
            contact_name,
            phone,
            email,
            notes: text(self.notes, 4000, TEXT)?,
            next_follow_up: day(self.next_follow_up)?,
            ..self
        })
    }
}

#[cfg(test)]
#[path = "input_tests.rs"]
mod tests;
