//! The edges of every budget band (packet MK2): a value in the band holds it, one dirham more
//! moves up a band, and the plus band takes everything above the last number.
use super::*;

#[test]
fn each_buying_band_holds_its_own_number_and_one_more_moves_up() {
    let edges = [
        (1_000_000, "buy_1m", "buy_2m"),
        (2_000_000, "buy_2m", "buy_3m"),
        (3_000_000, "buy_3m", "buy_5m"),
        (5_000_000, "buy_5m", "buy_10m"),
        (10_000_000, "buy_10m", "buy_10m_plus"),
    ];
    for (value, at, above) in edges {
        assert_eq!(band("buy", value), at, "{value}");
        assert_eq!(band("buy", value + 1), above, "{}", value + 1);
    }
    assert_eq!(band("buy", 1), "buy_1m");
    assert_eq!(band("buy", i64::MAX), "buy_10m_plus");
}

#[test]
fn each_rental_band_holds_its_own_number_and_one_more_moves_up() {
    let edges = [
        (50_000, "rent_50k", "rent_100k"),
        (100_000, "rent_100k", "rent_150k"),
        (150_000, "rent_150k", "rent_250k"),
        (250_000, "rent_250k", "rent_500k"),
        (500_000, "rent_500k", "rent_500k_plus"),
    ];
    for (value, at, above) in edges {
        assert_eq!(band("rent", value), at, "{value}");
        assert_eq!(band("rent", value + 1), above, "{}", value + 1);
    }
    assert_eq!(band("rent", 40_000), "rent_50k");
    assert_eq!(band("rent", i64::MAX), "rent_500k_plus");
}

#[test]
fn a_purchase_and_a_rental_never_share_a_band() {
    for (name, _) in BUY {
        assert!(name.starts_with("buy_"), "{name}");
    }
    for (name, _) in RENT {
        assert!(name.starts_with("rent_"), "{name}");
    }
}
