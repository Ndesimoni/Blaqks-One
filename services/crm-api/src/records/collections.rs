use crate::error::{ApiError, ApiResult};

pub struct Link {
    pub field: &'static str,
    pub target: &'static str,
}

pub struct Collection {
    pub name: &'static str,
    pub id_key: &'static str,
    pub links: &'static [Link],
}

const CONTACT: Link = Link {
    field: "contact_id",
    target: "Contacts",
};
const CLIENT: Link = Link {
    field: "client_id",
    target: "Clients",
};
const PROPERTY: Link = Link {
    field: "property_id",
    target: "Properties",
};
const OPTIONAL_PROPERTY: Link = Link {
    field: "property_id_optional",
    target: "Properties",
};

const fn workflow(name: &'static str, id_key: &'static str, links: &'static [Link]) -> Collection {
    Collection {
        name,
        id_key,
        links,
    }
}

/// Connected collections ordered so every linked record follows its target.
pub const COLLECTIONS: &[Collection] = &[
    workflow("Contacts", "contact_id", &[]),
    workflow("Clients", "client_id", &[]),
    workflow("Properties", "property_id", &[CONTACT]),
    workflow("Follow-ups", "activity_id", &[CLIENT, PROPERTY]),
    workflow("Viewings", "viewing_id", &[CLIENT, PROPERTY]),
    workflow("Shortlist", "match_id", &[CLIENT, PROPERTY]),
    workflow("Interaction log", "log_id", &[CLIENT, OPTIONAL_PROPERTY]),
    workflow("Client care", "care_id", &[CLIENT, OPTIONAL_PROPERTY]),
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
}

impl Links {
    pub fn set(&mut self, target: &str, value: Option<String>) {
        match target {
            "Contacts" => self.contact = value,
            "Clients" => self.client = value,
            _ => self.property = value,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn links_always_follow_their_target_collection() {
        for (index, collection) in COLLECTIONS.iter().enumerate() {
            for link in collection.links {
                let target = COLLECTIONS.iter().position(|c| c.name == link.target);
                assert!(target.is_some_and(|target| target < index));
            }
        }
        assert!(find("Deals").is_err());
        assert_eq!(find("Viewings").unwrap().id_key, "viewing_id");
    }
}
