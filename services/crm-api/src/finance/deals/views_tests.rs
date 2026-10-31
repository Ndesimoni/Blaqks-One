use super::*;
use crate::finance::deals::{
    fixtures::{access, deal, figures},
    views,
};
use serde_json::json;

fn keys(value: &Value) -> Vec<String> {
    let mut keys: Vec<String> = value.as_object().unwrap().keys().cloned().collect();
    keys.sort();
    keys
}

#[test]
fn the_own_view_has_an_exact_allowlist() {
    let (holder, second) = (Uuid::new_v4(), Uuid::new_v4());
    let viewer = Viewer {
        id: holder,
        team: false,
        access: access(false, false),
    };
    let view = views::deal(
        &deal(holder, second),
        Some(&figures(holder, second)),
        &viewer,
    );
    let expected = "agreedValueFils allowed assignee calculation clientId dealId dealType details \
        earnedOn feeBasis feeRateBp fixedFeeFils id outstandingFils partnerName partnerShareBp \
        paymentStatus pendingHandover propertyId receivedFils secondAgent stage version";
    assert_eq!(
        keys(&view).join(" "),
        expected.split_whitespace().collect::<Vec<_>>().join(" ")
    );
    assert_eq!(view["secondAgent"], json!({"name": "Second"}));
    let calc = &view["calculation"];
    let own = "adjusted grossFils lines netFils partnerFils preview revision vatFils";
    assert_eq!(keys(calc).join(" "), own);
    assert_eq!(
        calc["lines"],
        json!([{"role": "primary", "amountFils": 2_940_000}])
    );
    assert_eq!(calc["adjusted"], json!(true));
    assert!(!view.to_string().contains("980000") && !view.to_string().contains("Synthetic"));
    assert_eq!(view["allowed"]["earn"], json!(false));
}

#[test]
fn the_team_view_adds_company_lines_override_and_split_details() {
    let (holder, second) = (Uuid::new_v4(), Uuid::new_v4());
    let viewer = Viewer {
        id: Uuid::new_v4(),
        team: true,
        access: access(true, true),
    };
    let mut row = deal(holder, second);
    let view = views::deal(&row, Some(&figures(holder, second)), &viewer);
    assert_eq!(
        view["override"],
        json!({"agentShareBp": 8000, "reason": "Synthetic reason"})
    );
    assert_eq!(view["secondAgent"]["shareBp"], json!(2500));
    let calc = &view["calculation"];
    assert_eq!(calc["companyFils"], json!(980_000));
    assert_eq!(calc["splitSource"], json!("override"));
    assert_eq!(calc["lines"].as_array().unwrap().len(), 2);
    assert_eq!(view["paymentStatus"], json!("outstanding"));
    assert_eq!(view["outstandingFils"], json!(4_900_000));
    let allowed = &view["allowed"];
    assert_eq!(
        (allowed["revise"].clone(), allowed["split"].clone()),
        (json!(true), json!(false))
    );
    row.earned_on = None;
    row.ever_earned = false;
    row.stage = "Offer".into();
    let allowed = views::allowed(&row, &viewer);
    assert_eq!(allowed["earn"], json!(true));
    assert_eq!(allowed["delete"], json!(true));
    let staff = Viewer {
        id: second,
        team: true,
        access: access(true, false),
    };
    assert_eq!(
        views::allowed(&row, &staff)["earn"],
        json!(false),
        "second agent"
    );
    row.reassigned_by_actor = true;
    let other = Viewer {
        id: Uuid::new_v4(),
        ..staff
    };
    assert_eq!(
        views::allowed(&row, &other)["earn"],
        json!(false),
        "reassigned"
    );
}
