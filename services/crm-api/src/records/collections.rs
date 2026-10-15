use crate::error::{ApiError, ApiResult};

/// Database column that stores one link; each slot has its own foreign key.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Slot {
    Contact,
    Client,
    Property,
    Referral,
    /// An Interaction log's deal (`deal_ref`, finance-design §6.3, §13 L-F7). It targets
    /// finance's deals table, not a connected collection, and imports always leave it NULL.
    Deal,
}

impl Slot {
    /// Only the referral key is checked at commit, so only it may link a
    /// collection to itself (for example a Client referred by another Client).
    pub const fn deferred(self) -> bool {
        matches!(self, Slot::Referral)
    }

    /// Whether the slot targets a connected `crm_records` collection.
    pub const fn record(self) -> bool {
        !matches!(self, Slot::Deal)
    }
}

pub struct Link {
    pub field: &'static str,
    pub target: &'static str,
    pub slot: Slot,
}

pub struct Collection {
    pub name: &'static str,
    pub id_key: &'static str,
    pub links: &'static [Link],
}

const CONTACT: Link = Link {
    field: "contact_id",
    target: "Contacts",
    slot: Slot::Contact,
};
const CLIENT: Link = Link {
    field: "client_id",
    target: "Clients",
    slot: Slot::Client,
};
const PROPERTY: Link = Link {
    field: "property_id",
    target: "Properties",
    slot: Slot::Property,
};
const OPTIONAL_PROPERTY: Link = Link {
    field: "property_id_optional",
    target: "Properties",
    slot: Slot::Property,
};
const REFERRER: Link = Link {
    field: "referred_by_client_id",
    target: "Clients",
    slot: Slot::Referral,
};
const REFERRED_CLIENT: Link = Link {
    field: "referred_client_id",
    target: "Clients",
    slot: Slot::Referral,
};

const DEAL: Link = Link {
    field: "deal_id_optional",
    target: "Deals",
    slot: Slot::Deal,
};

const fn workflow(name: &'static str, id_key: &'static str, links: &'static [Link]) -> Collection {
    Collection {
        name,
        id_key,
        links,
    }
}

/// Connected collections ordered so every linked record follows its target;
/// deferred referral links may also point within their own collection. The deal link
/// targets the finance table, which no import or collection order creates.
pub const COLLECTIONS: &[Collection] = &[
    workflow("Contacts", "contact_id", &[]),
    workflow("Clients", "client_id", &[REFERRER]),
    workflow("Properties", "property_id", &[CONTACT]),
    workflow("Follow-ups", "activity_id", &[CLIENT, PROPERTY]),
    workflow("Viewings", "viewing_id", &[CLIENT, PROPERTY]),
    workflow("Shortlist", "match_id", &[CLIENT, PROPERTY]),
    workflow(
        "Interaction log",
        "log_id",
        &[CLIENT, OPTIONAL_PROPERTY, DEAL],
    ),
    workflow(
        "Client care",
        "care_id",
        &[CLIENT, OPTIONAL_PROPERTY, REFERRED_CLIENT],
    ),
];

pub fn find(name: &str) -> ApiResult<&'static Collection> {
    COLLECTIONS
        .iter()
        .find(|collection| collection.name == name)
        .ok_or_else(|| ApiError::invalid("Unsupported record collection."))
}

/// Database link columns for one validated record.
#[derive(Clone, Debug, Default)]
pub struct Links {
    pub contact: Option<String>,
    pub client: Option<String>,
    pub property: Option<String>,
    pub referral: Option<String>,
    pub deal: Option<String>,
}

impl Links {
    pub fn set(&mut self, slot: Slot, value: Option<String>) {
        match slot {
            Slot::Contact => self.contact = value,
            Slot::Client => self.client = value,
            Slot::Property => self.property = value,
            Slot::Referral => self.referral = value,
            Slot::Deal => self.deal = value,
        }
    }
}

#[cfg(test)]
#[path = "collections_tests.rs"]
mod tests;
