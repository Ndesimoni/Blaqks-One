//! Budget bands (packet MK2): the board shows which band a request's maximum falls in, never the
//! exact number, which stays on the server for matching in MK3. Each band holds the values up to
//! its own number; above the last one the plus band applies. Buying is a total price, renting a
//! yearly figure.
pub const BUY: [(&str, i64); 6] = [
    ("buy_1m", 1_000_000),
    ("buy_2m", 2_000_000),
    ("buy_3m", 3_000_000),
    ("buy_5m", 5_000_000),
    ("buy_10m", 10_000_000),
    ("buy_10m_plus", i64::MAX),
];

pub const RENT: [(&str, i64); 6] = [
    ("rent_50k", 50_000),
    ("rent_100k", 100_000),
    ("rent_150k", 150_000),
    ("rent_250k", 250_000),
    ("rent_500k", 500_000),
    ("rent_500k_plus", i64::MAX),
];

/// The band for a purpose and a maximum budget. A purchase and a rental never share a band.
pub fn band(purpose: &str, maximum: i64) -> &'static str {
    let table = match purpose {
        "rent" => RENT,
        _ => BUY,
    };
    for (name, limit) in table {
        if maximum <= limit {
            return name;
        }
    }
    table[table.len() - 1].0
}

/// Whether a board filter names a band the marketplace knows.
pub fn known(name: &str) -> bool {
    BUY.iter().chain(RENT.iter()).any(|(band, _)| *band == name)
}

#[cfg(test)]
#[path = "bands_tests.rs"]
mod tests;
