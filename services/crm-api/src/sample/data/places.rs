//! Real UAE buildings and communities shared by sample listings and their contacts.
//! Only the locations are real; every person, unit and price is fictional.
use serde_json::{json, Value};
use url::form_urlencoded::byte_serialize;

pub struct Place {
    pub building: &'static str,
    pub community: &'static str,
    pub emirate: &'static str,
}

const fn place(building: &'static str, community: &'static str, emirate: &'static str) -> Place {
    Place {
        building,
        community,
        emirate,
    }
}

pub const MARINA_GATE: Place = place("Marina Gate 1", "Dubai Marina", "Dubai");
pub const PRINCESS_TOWER: Place = place("Princess Tower", "Dubai Marina", "Dubai");
pub const BLOOM_TOWERS: Place = place("Bloom Towers", "JVC", "Dubai");
pub const BELGRAVIA: Place = place("Belgravia Heights 1", "JVC", "Dubai");
pub const BURJ_ROYALE: Place = place("Burj Royale", "Downtown Dubai", "Dubai");
pub const BOULEVARD_POINT: Place = place("Boulevard Point", "Downtown Dubai", "Dubai");
pub const EXECUTIVE_TOWERS: Place = place("Executive Towers", "Business Bay", "Dubai");
pub const BAY_SQUARE: Place = place("Bay Square", "Business Bay", "Dubai");
pub const SUN_TOWER: Place = place("Sun Tower", "Al Reem Island", "Abu Dhabi");
pub const GATE_TOWER: Place = place("The Gate Tower 2", "Al Reem Island", "Abu Dhabi");
pub const PARK_RIDGE: Place = place("Park Ridge", "Dubai Hills Estate", "Dubai");
pub const SHORELINE: Place = place("Shoreline Apartments", "Palm Jumeirah", "Dubai");

pub const ALL: [&Place; 12] = [
    &MARINA_GATE,
    &PRINCESS_TOWER,
    &BLOOM_TOWERS,
    &BELGRAVIA,
    &BURJ_ROYALE,
    &BOULEVARD_POINT,
    &EXECUTIVE_TOWERS,
    &BAY_SQUARE,
    &SUN_TOWER,
    &GATE_TOWER,
    &PARK_RIDGE,
    &SHORELINE,
];

pub fn find(building: &str) -> Option<&'static Place> {
    ALL.into_iter().find(|place| place.building == building)
}

impl Place {
    pub fn address(&self) -> String {
        format!(
            "{}, {}, {}, UAE",
            self.building, self.community, self.emirate
        )
    }

    /// An https Google Maps search link for the building (no coordinates stored).
    pub fn map_link(&self) -> String {
        let query: String = byte_serialize(self.address().as_bytes()).collect();
        format!("https://www.google.com/maps/search/?api=1&query={query}")
    }

    /// The shared location fields of Contacts and Properties.
    pub fn fields(&self) -> Value {
        json!({
            "building_project": self.building,
            "community": self.community,
            "emirate": self.emirate,
            "address": self.address(),
            "map_link": self.map_link(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_links_are_encoded_https_searches() {
        let link = MARINA_GATE.map_link();
        assert_eq!(
            link,
            "https://www.google.com/maps/search/?api=1&query=Marina+Gate+1%2C+Dubai+Marina%2C+Dubai%2C+UAE"
        );
        assert_eq!(SUN_TOWER.fields()["emirate"], "Abu Dhabi");
        assert_eq!(BLOOM_TOWERS.address(), "Bloom Towers, JVC, Dubai, UAE");
    }
}
