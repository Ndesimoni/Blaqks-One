//! The staff position catalogue. Each row grants module views; positions never grant
//! channels, exports, full-team scope or deleteMain.

/// `(id, label, [relationships, properties, schedule, finance, reports])`.
pub const TABLE: [(&str, &str, [bool; 5]); 8] = [
    (
        "receptionist",
        "Receptionist",
        [true, false, true, false, false],
    ),
    (
        "lead-manager",
        "Lead Manager",
        [true, false, true, false, true],
    ),
    (
        "property-agent",
        "Property Agent",
        [true, true, true, false, true],
    ),
    (
        "listing-coordinator",
        "Listing Coordinator",
        [true, true, false, false, false],
    ),
    (
        "accountant",
        "Accountant",
        [false, false, false, true, true],
    ),
    (
        "property-manager",
        "Property Manager",
        [true, true, true, false, true],
    ),
    (
        "marketing-coordinator",
        "Marketing Coordinator",
        [true, false, false, false, true],
    ),
    (
        "team-supervisor",
        "Team Supervisor",
        [true, true, true, false, true],
    ),
];
