//! Ten fictional brokerages Blaqks One is selling to, at every stage, with what happened.
//! Names get the "Sample · " label when written.
use super::{
    client_spec::{client, Client},
    people::Who::{Grace, Omar, Owner},
};

pub const CLIENTS: [Client; 10] = [
    client("Palm Crest Realty", "Hana Yousef", 921, "palmcrest").added(
        1,
        "We are six agents in Dubai Marina and want one place for leads and WhatsApp.",
    ),
    client("Marina Gate Properties", "Tariq Saeed", 922, "marinagate")
        .stage("new", Omar, Some(1))
        .added(2, "Looking for a CRM with a website for our listings.")
        .history(&[("assigned", "Assigned to Sample · Omar Haddad", 2, Owner)]),
    client("Desert Rose Homes", "Mariam Khalil", 923, "desertrose")
        .source("referral")
        .stage("contacted", Omar, Some(0))
        .added(9, "Referred by a customer. Eight agents, mostly rentals.")
        .history(&[
            (
                "call",
                "Ten-minute call: they keep leads in spreadsheets.",
                7,
                Omar,
            ),
            ("stage", "New → Contacted", 7, Omar),
            (
                "whatsapp",
                "Sent the demo video and the price list.",
                6,
                Omar,
            ),
        ]),
    client("Creekside Brokers", "Yusuf Rahman", 924, "creekside")
        .source("call")
        .stage("contacted", Grace, Some(-2))
        .added(14, "Owner-run office in Deira, twelve agents.")
        .history(&[
            (
                "call",
                "Interested but busy until month end. Call back.",
                12,
                Grace,
            ),
            ("stage", "New → Contacted", 12, Grace),
        ]),
    client("Oasis Point Realty", "Sara Lindqvist", 925, "oasispoint")
        .stage("demo_booked", Omar, Some(3))
        .added(18, "Can you show us how the company website works?")
        .history(&[
            (
                "call",
                "Walked through the plans; both team leads want a demo.",
                10,
                Omar,
            ),
            ("stage", "New → Contacted", 10, Omar),
            (
                "email",
                "Confirmed the demo for Thursday at 11:00.",
                4,
                Omar,
            ),
            ("stage", "Contacted → Demo booked", 4, Omar),
        ]),
    client(
        "Skyline Key Real Estate",
        "Imran Qureshi",
        926,
        "skylinekey",
    )
    .source("referral")
    .stage("demo_booked", Grace, Some(5))
    .added(
        21,
        "Fifteen agents, off-plan. Referred by Sample · Al Noor Living.",
    )
    .history(&[
        ("stage", "New → Contacted", 16, Grace),
        (
            "note",
            "Wants co-broking between companies in the demo.",
            9,
            Grace,
        ),
        ("stage", "Contacted → Demo booked", 9, Grace),
    ]),
    client("Harbour Line Estates", "Elena Costa", 927, "harbourline")
        .source("call")
        .stage("signed_up", Owner, Some(7))
        .added(35, "Signed up for ten seats; onboarding call booked.")
        .history(&[
            ("stage", "New → Contacted", 30, Owner),
            ("stage", "Contacted → Demo booked", 20, Owner),
            ("stage", "Demo booked → Signed up", 6, Owner),
        ]),
    client("Al Noor Living", "Ahmed Bakr", 928, "alnoor")
        .source("help_request")
        .stage("customer", Grace, None)
        .added(60, "Paying since last month; happy with the website.")
        .history(&[
            ("stage", "New → Signed up", 45, Grace),
            ("stage", "Signed up → Customer", 20, Grace),
            ("note", "Asked about two more seats next quarter.", 3, Grace),
        ]),
    client("Golden Sands Brokerage", "Chen Wei", 929, "goldensands")
        .source("call")
        .stage("lost", Omar, None)
        .added(
            40,
            "Staying with their current system this year. Try next spring.",
        )
        .history(&[
            ("stage", "New → Contacted", 35, Omar),
            ("stage", "Contacted → Demo booked", 25, Omar),
            ("stage", "Demo booked → Lost", 15, Omar),
        ]),
    client("Blue Lagoon Homes", "Nadia Petrova", 930, "bluelagoon")
        .source("other")
        .added(
            0,
            "Met at a property expo; asked for prices for three agents.",
        ),
];
