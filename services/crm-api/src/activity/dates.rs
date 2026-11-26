//! Dubai calendar days (fixed UTC+4, no daylight saving) as microsecond bounds.
use std::time::{SystemTime, UNIX_EPOCH};

const DAY_MICROS: i64 = 86_400_000_000;
const DUBAI_OFFSET_MICROS: i64 = 4 * 3_600_000_000;
/// Default window: the last 90 Dubai days, today included.
pub const DEFAULT_DAYS: i64 = 90;
/// Longest allowed window, both ends included.
pub const MAX_DAYS: i64 = 366;

/// Days since 1970-01-01 for a proleptic Gregorian date (Hinnant's algorithm).
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = year.div_euclid(400);
    let year_of_era = year - era * 400;
    let shifted = (month + 9) % 12;
    let day_of_year = (153 * shifted + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

fn days_in_month(year: i64, month: i64) -> i64 {
    match month {
        2 if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

/// Parses a strict `YYYY-MM-DD` (years 2000–2999) into a day number.
pub fn parse_day(value: &str) -> Option<i64> {
    let bytes = value.as_bytes();
    let shape = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit());
    if !shape {
        return None;
    }
    let number = |range: std::ops::Range<usize>| value[range].parse::<i64>().ok();
    let (year, month, day) = (number(0..4)?, number(5..7)?, number(8..10)?);
    let valid = (2000..=2999).contains(&year)
        && (1..=12).contains(&month)
        && (1..=days_in_month(year, month)).contains(&day);
    valid.then(|| days_from_civil(year, month, day))
}

/// Today's Dubai day number.
pub fn today() -> i64 {
    let micros = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_micros() as i64)
        .unwrap_or(0);
    (micros + DUBAI_OFFSET_MICROS).div_euclid(DAY_MICROS)
}

/// The UTC instant (µs) at which Dubai day `day` starts.
pub fn start_micros(day: i64) -> i64 {
    day * DAY_MICROS - DUBAI_OFFSET_MICROS
}

/// Resolves optional `from`/`to` into an inclusive day range, or `None` when a date is
/// malformed, the range is reversed or it spans more than [`MAX_DAYS`].
pub fn range(from: Option<&str>, to: Option<&str>, today: i64) -> Option<(i64, i64)> {
    let to = match to {
        Some(value) => parse_day(value)?,
        None => today,
    };
    let from = match from {
        Some(value) => parse_day(value)?,
        None => to - (DEFAULT_DAYS - 1),
    };
    (to >= from && to - from < MAX_DAYS).then_some((from, to))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn days_are_strict_and_dubai_midnight_is_twenty_hundred_utc() {
        assert_eq!(parse_day("2026-10-16"), Some(days_from_civil(2026, 10, 16)));
        assert_eq!(parse_day("2000-01-01"), Some(10_957));
        for bad in [
            "2026-1-01",
            "2026-02-30",
            "2025-02-29",
            "1999-12-31",
            "2026-10-16x",
        ] {
            assert_eq!(parse_day(bad), None, "{bad}");
        }
        assert!(parse_day("2024-02-29").is_some());
        // 2000-01-01 00:00 in Dubai is 1999-12-31 20:00 UTC.
        assert_eq!(start_micros(10_957), 946_684_800_000_000 - 14_400_000_000);
    }

    #[test]
    fn ranges_default_to_ninety_days_and_cap_the_span() {
        let today = parse_day("2026-10-16").unwrap();
        assert_eq!(range(None, None, today), Some((today - 89, today)));
        let year = range(Some("2025-01-01"), Some("2026-01-01"), today);
        assert_eq!(year.map(|(from, to)| to - from + 1), Some(366));
        assert_eq!(range(Some("2025-01-01"), Some("2026-01-02"), today), None);
        assert_eq!(range(Some("2026-10-02"), Some("2026-10-01"), today), None);
        assert!(range(Some("2026-10-01"), Some("2026-10-01"), today).is_some());
    }
}
