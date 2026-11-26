//! What the sample Blaqks One team says in Team chat: a short morning in #general and one
//! direct conversation between the Owner and Sample · Grace Mensah.
use super::people::Who::{self, Daniel, Grace, Omar, Owner, Priya};

/// `(who, text, minutes ago)`.
pub type Line = (Who, &'static str, i32);

pub const GENERAL: [Line; 5] = [
    (
        Owner,
        "Welcome to our team chat: sales, support and numbers here.",
        2_880,
    ),
    (
        Grace,
        "Two demos booked this week; Al Noor Living asked about seats.",
        1_440,
    ),
    (
        Omar,
        "The Oasis Point demo is Thursday at 11:00. Notes after.",
        1_200,
    ),
    (
        Priya,
        "One help request is waiting on WhatsApp setup; I'm on it.",
        300,
    ),
    (
        Daniel,
        "Website enquiries are up this month; see the Dashboard.",
        120,
    ),
];

pub const DIRECT: [Line; 2] = [
    (
        Owner,
        "Can you take the Creekside call? It's two days overdue.",
        90,
    ),
    (Grace, "Yes, calling them this afternoon.", 75),
];
