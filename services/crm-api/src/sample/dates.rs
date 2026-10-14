//! Workbook dates relative to today in UAE time (UTC+4), as the demo stores them:
//! `YYYY-MM-DD` and `YYYY-MM-DDTHH:MM`.
use std::time::{SystemTime, UNIX_EPOCH};

const UAE_OFFSET_SECONDS: u64 = 4 * 60 * 60;

#[derive(Clone, Copy, Debug)]
pub struct Calendar {
    /// Days since 1970-01-01.
    pub today: i64,
}

impl Calendar {
    pub fn now() -> Self {
        let seconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_secs())
            .unwrap_or_default();
        Self {
            today: ((seconds + UAE_OFFSET_SECONDS) / 86_400) as i64,
        }
    }

    /// The date `offset` days from today.
    pub fn day(&self, offset: i64) -> String {
        civil(self.today + offset)
    }

    /// The date `offset` days from today at `time` (`HH:MM`).
    pub fn at(&self, offset: i64, time: &str) -> String {
        format!("{}T{time}", self.day(offset))
    }
}

/// Gregorian date for a day count (Howard Hinnant's `civil_from_days`).
fn civil(days: i64) -> String {
    let shifted = days + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_calendar_dates_across_months_and_leap_years() {
        assert_eq!(civil(0), "1970-01-01");
        assert_eq!(civil(19_723), "2024-01-01");
        assert_eq!(civil(19_723 + 59), "2024-02-29");
        assert_eq!(civil(19_723 + 365), "2024-12-31");
        assert_eq!(civil(20_740), "2026-10-14");
        assert_eq!(civil(-1), "1969-12-31");
        let calendar = Calendar { today: 20_740 };
        assert_eq!(calendar.day(-14), "2026-09-30");
        assert_eq!(calendar.at(1, "11:30"), "2026-10-15T11:30");
        assert!(Calendar::now().today > 20_000);
    }
}
