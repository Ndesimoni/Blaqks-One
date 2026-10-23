//! The share's last day (owner 2026-10-23): a Dubai day, ending 23:59:59 Dubai time, from
//! today to 90 days ahead; 30 days by default on the screen. An extension moves it later,
//! never beyond 90 days from the day of the extension.
use crate::error::{ApiError, ApiResult};
use time::{
    format_description::well_known::{Iso8601, Rfc3339},
    Date, Duration, OffsetDateTime, Time, UtcOffset,
};

pub const MAX_DAYS: i64 = 90;
pub const INVALID: &str = "Choose a last day from today to 90 days ahead.";
pub const NOT_LATER: &str = "Choose a later last day than the current one.";

fn dubai() -> UtcOffset {
    UtcOffset::from_hms(4, 0, 0).unwrap_or(UtcOffset::UTC)
}

/// Today in Dubai at `now`.
pub fn today(now: OffsetDateTime) -> Date {
    now.to_offset(dubai()).date()
}

/// The end of `day` in Dubai.
pub fn end_of(day: Date) -> OffsetDateTime {
    let last = Time::from_hms(23, 59, 59).unwrap_or(Time::MIDNIGHT);
    day.with_time(last).assume_offset(dubai())
}

/// The end of the Dubai day `raw` ("YYYY-MM-DD"), if it is from today to 90 days ahead.
pub fn last_day(raw: &str, now: OffsetDateTime) -> ApiResult<OffsetDateTime> {
    let day = Date::parse(raw, &Iso8601::DATE).map_err(|_| ApiError::invalid(INVALID))?;
    let first = today(now);
    if raw.len() != 10 || day < first || day > first + Duration::days(MAX_DAYS) {
        return Err(ApiError::invalid(INVALID));
    }
    Ok(end_of(day))
}

/// RFC 3339 text for binding as `timestamptz`.
pub fn stamp(at: OffsetDateTime) -> ApiResult<String> {
    at.format(&Rfc3339).map_err(|_| ApiError::invalid(INVALID))
}

#[cfg(test)]
mod tests {
    use super::*;
    use time::Month;

    fn utc(day: u8, hour: u8, minute: u8, second: u8) -> OffsetDateTime {
        let date = Date::from_calendar_date(2026, Month::October, day).expect("date");
        date.with_hms(hour, minute, second)
            .expect("time")
            .assume_utc()
    }

    #[test]
    fn a_last_day_ends_at_midnight_dubai_and_stays_within_ninety_days() {
        let now = utc(23, 21, 30, 0); // already 24 October in Dubai
        assert_eq!(today(now).to_string(), "2026-10-24");
        let end = last_day("2026-10-24", now).expect("today is allowed");
        assert_eq!(end, utc(24, 19, 59, 59));
        assert!(last_day("2026-10-23", now).is_err());
        assert!(last_day("2027-01-22", now).is_ok());
        assert!(last_day("2027-01-23", now).is_err());
        assert!(last_day("24/10/2026", now).is_err());
    }
}
