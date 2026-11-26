use super::*;
use crate::{auth::identity_rules as validation, records::visibility::ASSIGNABLE};

#[test]
fn specs_are_valid_members_with_distinct_grants() {
    for spec in &SPECS {
        let email = spec.email("Aidah.K@example.com");
        assert!(email.starts_with(spec.handle) && email.ends_with("+aidahk@example.test"));
        assert!(validation::identity(&spec.name(), &email, spec.phone).is_ok());
        assert!(spec.name().starts_with("Sample · "));
        let actions = spec.actions();
        assert_eq!(actions.deletes_main(), spec.team_scope);
        assert!(!actions.properties.delete_main);
        assert_eq!(
            actions,
            actions.normalised(&spec.permissions(), spec.team_scope)
        );
    }
    assert!(SPECS[0].actions().schedule.create && !SPECS[0].actions().deletes_main());
    assert_eq!(SPECS[2].actions(), Actions::default());
    assert!(SPECS[2].permissions().relationships && !SPECS[2].permissions().properties);
}

#[test]
fn every_held_record_is_assignable_and_inside_the_members_modules() {
    let mut seen = std::collections::HashSet::new();
    let all = super::super::data::records(&super::super::dates::Calendar { today: 0 });
    for spec in &SPECS {
        for id in spec.holds {
            assert!(seen.insert(*id), "{id} is held twice");
            let collection = match &id[..2] {
                "CL" => "Clients",
                "PR" => "Properties",
                _ => "Contacts",
            };
            assert!(ASSIGNABLE.contains(&collection));
            assert!(spec.permissions().collection(collection), "{id}");
            let key = crate::records::validation::collection_key(collection).unwrap();
            assert!(all.rows(collection).iter().any(|row| row[key] == *id));
        }
    }
}
