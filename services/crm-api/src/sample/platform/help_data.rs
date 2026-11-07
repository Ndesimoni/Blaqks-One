//! Five fictional help requests from company members, one for each way a request can stand:
//! new and unassigned, answered and unread, solved, reopened by a reply, and an idea.
use super::people::Who::{self, Nobody, Owner, Priya};

/// One message: `(from Blaqks One, text, minutes after the request was opened, who)`.
/// A member's message comes from the requester, so its `who` is ignored.
pub type Message = (bool, &'static str, i32, Who);

pub struct Request {
    pub category: &'static str,
    pub subject: &'static str,
    pub state: &'static str,
    pub assignee: Who,
    pub opened_minutes_ago: i32,
    /// The member has read every answer.
    pub read: bool,
    pub messages: &'static [Message],
}

pub const REQUESTS: [Request; 5] = [
    Request {
        category: "how_to",
        subject: "How do I import my old Excel client list?",
        state: "open",
        assignee: Nobody,
        opened_minutes_ago: 180,
        read: true,
        messages: &[(
            false,
            "We have about 200 clients in an Excel file. Can we bring them in?",
            0,
            Nobody,
        )],
    },
    Request {
        category: "problem",
        subject: "WhatsApp messages show as not sent",
        state: "waiting",
        assignee: Priya,
        opened_minutes_ago: 1_440,
        read: false,
        messages: &[
            (
                false,
                "Since this morning every WhatsApp message says not sent.",
                0,
                Nobody,
            ),
            (
                true,
                "Your WhatsApp number is not connected. Your Admin connects it under Channels.",
                40,
                Priya,
            ),
        ],
    },
    Request {
        category: "billing",
        subject: "Add five more seats to our plan",
        state: "solved",
        assignee: Owner,
        opened_minutes_ago: 8_640,
        read: true,
        messages: &[
            (
                false,
                "We hired five agents. Can we go from 10 to 15 seats?",
                0,
                Nobody,
            ),
            (true, "Done: your seat limit is now 15.", 180, Owner),
            (false, "Thank you, all set.", 240, Nobody),
        ],
    },
    Request {
        category: "account",
        subject: "A colleague's invitation link has expired",
        state: "open",
        assignee: Priya,
        opened_minutes_ago: 2_880,
        read: true,
        messages: &[
            (
                false,
                "Our new agent never used her invitation and now it says expired.",
                0,
                Nobody,
            ),
            (
                true,
                "Your Admin can resend it from Team & access; the new link lasts seven days.",
                120,
                Priya,
            ),
            (
                false,
                "We resent it, but she still sees the expired page.",
                1_500,
                Nobody,
            ),
        ],
    },
    Request {
        category: "idea",
        subject: "Show the commission total on each Kanban column",
        state: "open",
        assignee: Nobody,
        opened_minutes_ago: 300,
        read: true,
        messages: &[(
            false,
            "It would help our weekly meeting to see commission per stage.",
            0,
            Nobody,
        )],
    },
];
