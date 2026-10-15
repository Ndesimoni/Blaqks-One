use super::*;
use crate::auth::policy;
use crate::records::visibility::{ASSIGNABLE, PARENTS};

#[test]
fn links_follow_their_target_unless_deferred_within_a_collection() {
    for (index, collection) in COLLECTIONS.iter().enumerate() {
        for link in collection.links.iter().filter(|link| link.slot.record()) {
            let target = COLLECTIONS.iter().position(|c| c.name == link.target);
            let target = target.expect("link target must be a connected collection");
            assert!(target < index || (target == index && link.slot.deferred()));
        }
    }
    let clients = find("Clients").unwrap();
    assert!(clients.links.iter().all(|link| link.slot == Slot::Referral));
    assert!(find("Deals").is_err());
    assert_eq!(find("Viewings").unwrap().id_key, "viewing_id");
}

#[test]
fn only_the_interaction_log_links_a_deal() {
    let linking: Vec<&str> = COLLECTIONS
        .iter()
        .filter(|collection| collection.links.iter().any(|link| !link.slot.record()))
        .map(|collection| collection.name)
        .collect();
    assert_eq!(linking, ["Interaction log"]);
    let deal = find("Interaction log").unwrap().links.last().unwrap();
    assert_eq!((deal.field, deal.target), ("deal_id_optional", "Deals"));
    assert!(!Slot::Deal.deferred() && !Slot::Deal.record());
    let mut links = Links::default();
    links.set(Slot::Deal, Some("DL-0001".into()));
    assert_eq!(links.deal.as_deref(), Some("DL-0001"));
    assert!(links.referral.is_none() && links.client.is_none());
}

#[test]
fn the_auth_policy_copy_matches_the_collection_table() {
    let names: Vec<&str> = COLLECTIONS
        .iter()
        .map(|collection| collection.name)
        .collect();
    assert_eq!(names, policy::COLLECTIONS);
    assert_eq!((ASSIGNABLE, PARENTS), (policy::ASSIGNABLE, policy::PARENTS));
    let targets = COLLECTIONS
        .iter()
        .flat_map(|collection| collection.links.iter());
    let mut targets: Vec<&str> = targets.map(|link| link.target).collect();
    targets.sort_unstable();
    targets.dedup();
    let listed: Vec<&str> = policy::LINKED_FROM
        .iter()
        .map(|(target, _)| *target)
        .collect();
    assert_eq!(targets, listed);
    for target in names.iter().chain(&["Deals"]) {
        let linking: Vec<&str> = COLLECTIONS
            .iter()
            .filter(|linking| linking.links.iter().any(|link| link.target == *target))
            .map(|linking| linking.name)
            .collect();
        assert_eq!(linking, policy::linked_from(target), "{target}");
    }
}
