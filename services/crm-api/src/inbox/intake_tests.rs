//! Intake contracts on the disposable test database (plan X3 tests: matching, rules,
//! routing and replay).
use super::{intake::receive, intake_fixtures::company};
use crate::integrations::webhooks::message::Source;
use serde_json::json;

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn an_exact_phone_match_joins_the_client_and_a_replay_adds_nothing() {
    let co = company().await;
    let (client, _) = co
        .record(
            "Clients",
            json!({"full_name": "Synthetic Client", "phone": "050 000 1234"}),
        )
        .await;
    let event = co.event("whatsapp", "t-match", "+971 50 000 1234", "Hello again");
    receive(&co.pool, &event).await.unwrap();
    receive(&co.pool, &event).await.unwrap();
    let (state, linked, assignee, status, suggested, messages) = co.conversation("t-match").await;
    assert_eq!(
        (state.as_str(), linked, status.as_str()),
        ("linked", Some(client), "open")
    );
    assert_eq!(assignee, Some(co.owner));
    assert!(!suggested);
    assert_eq!(messages, 1);
    assert_eq!(co.clients().await, 1);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn several_matches_wait_for_a_person_and_names_never_merge() {
    let co = company().await;
    for name in ["Twin One", "Twin Two"] {
        co.record(
            "Clients",
            json!({"full_name": name, "email": "Shared@Example.test"}),
        )
        .await;
    }
    co.record("Clients", json!({"full_name": "Synthetic Sender"}))
        .await;
    let event = co.event(
        "email",
        "t-choice",
        "shared@example.test",
        "Two bedroom apartment to rent",
    );
    receive(&co.pool, &event).await.unwrap();
    let (state, linked, assignee, status, suggested, _) = co.conversation("t-choice").await;
    assert_eq!(
        (state.as_str(), linked, assignee, status.as_str()),
        ("choice", None, None, "new")
    );
    assert!(!suggested, "lead rules apply only to unknown senders");
    assert_eq!(co.clients().await, 3);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn a_listing_enquiry_creates_the_lead_and_goes_to_the_listing_agent() {
    let co = company().await;
    let (_, listing) = co
        .record(
            "Properties",
            json!({"listing_title": "Synthetic Marina Flat"}),
        )
        .await;
    let event = co.event("whatsapp", "t-ad", "+971500004321", "Is it available?");
    let event = co.sourced(event, Source::Listing, Some(&listing));
    receive(&co.pool, &event).await.unwrap();
    let (state, linked, assignee, status, _, _) = co.conversation("t-ad").await;
    assert_eq!((state.as_str(), status.as_str()), ("linked", "open"));
    assert!(linked.is_some());
    assert_eq!(assignee, Some(co.owner));
    assert_eq!(co.clients().await, 1);
}

#[tokio::test]
#[ignore = "requires disposable Docker API harness"]
async fn property_words_suggest_a_lead_and_small_talk_does_not() {
    let co = company().await;
    let words = co.event(
        "instagram",
        "t-words",
        "ig_user_1",
        "Looking for a villa to rent",
    );
    receive(&co.pool, &words).await.unwrap();
    let (state, linked, assignee, status, suggested, _) = co.conversation("t-words").await;
    assert_eq!(
        (state.as_str(), linked, assignee, status.as_str()),
        ("unknown", None, None, "new")
    );
    assert!(suggested);
    let chat = co.event("tiktok", "t-chat", "tt_user_1", "Love your videos!");
    receive(&co.pool, &chat).await.unwrap();
    assert!(!co.conversation("t-chat").await.4);
    assert_eq!(co.clients().await, 0);
}
