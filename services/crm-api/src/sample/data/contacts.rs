//! Sample landlords and owners linked to listings, plus a security guard and building
//! managers who share those buildings.
use super::{
    email, merge, name, phone,
    places::{Place, BLOOM_TOWERS, BURJ_ROYALE, EXECUTIVE_TOWERS, MARINA_GATE, SUN_TOWER},
    NOTE,
};
use serde_json::{json, Value};

fn contact(id: &str, person: &str, kind: &str, company: &str, number: u16, place: &Place) -> Value {
    let mut row = merge(
        json!({
            "contact_id": id,
            "full_name": name(person),
            "contact_type": kind,
            "phone": phone(number),
            "email": email(person),
            "notes": NOTE,
        }),
        place.fields(),
    );
    if !company.is_empty() {
        row["company"] = json!(company);
    }
    row
}

pub fn rows() -> Vec<Value> {
    vec![
        contact(
            "CT-S01",
            "Rashid Al Falasi",
            "Landlord",
            "",
            401,
            &MARINA_GATE,
        ),
        contact("CT-S02", "Priya Menon", "Owner", "", 402, &BLOOM_TOWERS),
        contact(
            "CT-S03",
            "Harbour Holdings",
            "Landlord",
            "Sample Harbour Holdings",
            403,
            &BURJ_ROYALE,
        ),
        contact(
            "CT-S04",
            "Elena Petrova",
            "Owner",
            "",
            404,
            &EXECUTIVE_TOWERS,
        ),
        contact(
            "CT-S05",
            "Saif Al Mazrouei",
            "Landlord",
            "",
            405,
            &SUN_TOWER,
        ),
        contact(
            "CT-S06",
            "Joseph Mensah",
            "Security guard",
            "Sample Tower Security",
            406,
            &MARINA_GATE,
        ),
        contact(
            "CT-S07",
            "Aisha Rahman",
            "Building manager",
            "Sample Tower Management",
            407,
            &BLOOM_TOWERS,
        ),
        contact(
            "CT-S08",
            "Vikram Rao",
            "Building manager",
            "Sample Facilities Co",
            408,
            &SUN_TOWER,
        ),
    ]
}
