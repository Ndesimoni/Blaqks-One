//! The dashboard's `totals`: platform figures today, whatever the period. Money is in
//! integer fils and only ever platform-wide. Website visitors are not counted yet (null);
//! outside agents with a free account do not exist until A6 ships (zero).
use super::gather::Gathered;
use crate::workspaces::platform::CompanyRow;
use serde_json::{json, Map, Value};

const COLLECTIONS: [&str; 8] = [
    "Clients",
    "Contacts",
    "Properties",
    "Follow-ups",
    "Viewings",
    "Shortlist",
    "Interaction log",
    "Client care",
];

pub fn totals(g: &Gathered, companies: &[CompanyRow]) -> Value {
    let status = |wanted: &str| companies.iter().filter(|c| c.status == wanted).count();
    let mut by_type = Map::new();
    for collection in COLLECTIONS {
        let count: i64 = g
            .records
            .iter()
            .filter(|(name, _)| name == collection)
            .map(|(_, count)| *count)
            .sum();
        by_type.insert(collection.to_owned(), json!(count));
    }
    let records: i64 = g.records.iter().map(|(_, count)| *count).sum();
    let (deals, between, market) = (&g.deals, &g.between, &g.market);
    let average = match deals.earned {
        0 => 0,
        earned => deals.earned_value_fils / earned,
    };
    json!({
        "companies": {
            "total": companies.len(), "active": status("active"), "archived": status("archived"),
        },
        "users": {
            "total": g.users.total, "admins": g.users.admins,
            "staff": g.users.staff, "pending": g.users.pending,
        },
        "activeUsers": {"today": g.active.0, "last7Days": g.active.1, "last30Days": g.active.2},
        "records": {"total": records, "byType": by_type},
        "websites": {
            "companySitesLive": g.sites.0, "generalSiteLive": g.sites.1,
            "listingsLive": g.listings,
        },
        "deals": {
            "recorded": deals.recorded, "open": deals.open, "earned": deals.earned,
            "lost": deals.lost, "earnedValueFils": deals.earned_value_fils,
            "openValueFils": deals.open_value_fils,
            "commissionEarnedFils": deals.commission_fils,
            "averageEarnedValueFils": average,
        },
        "payments": {"recorded": g.payments.0, "approvedFils": g.payments.1},
        "interBroker": {
            "agreements": between.agreements, "accepted": between.accepted,
            "completed": between.completed, "valueFils": between.value_fils,
            "commissionSharedFils": between.commission_fils,
        },
        "marketplace": {
            "companiesApproved": market.companies_approved, "members": market.members,
            "requestsPosted": market.requests_posted, "answers": market.answers,
        },
        "outsideAgents": 0,
        "websiteVisitors": null,
    })
}
