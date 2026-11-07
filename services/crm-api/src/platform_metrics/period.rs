//! The dashboard's period switch (30 days, 12 months, all time) and its twelve trend
//! months, all in Asia/Dubai calendar days as the database sees today.
use crate::error::{ApiError, ApiResult};
use sqlx::{Postgres, Transaction};

pub const INVALID: &str = "Choose a period of 30d, 12m or all.";
/// The lower bound used for "all time"; nothing on the platform is older.
const ALL_SINCE: &str = "1970-01-01";

pub struct Period {
    pub key: &'static str,
    /// The first day counted (inclusive).
    pub since: String,
    /// The first day shown: `since`, or for all time the first company's creation day.
    pub from: String,
    pub to: String,
    /// The first day of the oldest trend month.
    pub trend: String,
    /// Twelve `YYYY-MM` months, oldest first, the current month last.
    pub months: Vec<String>,
}

/// The period key from the query string: absent means 30 days.
pub fn key(raw: Option<&str>) -> ApiResult<&'static str> {
    match raw {
        None | Some("30d") => Ok("30d"),
        Some("12m") => Ok("12m"),
        Some("all") => Ok("all"),
        Some(_) => Err(ApiError::invalid(INVALID)),
    }
}

/// Resolves `key` against today; `first_company` is the oldest company's creation day.
pub async fn resolve(
    tx: &mut Transaction<'_, Postgres>,
    key: &'static str,
    first_company: Option<&str>,
) -> ApiResult<Period> {
    let (to, last_30, trend): (String, String, String) = sqlx::query_as(
        "SELECT d::text,(d-29)::text,(date_trunc('month',d)-interval '11 months')::date::text \
         FROM (SELECT (now() AT TIME ZONE 'Asia/Dubai')::date AS d) t",
    )
    .fetch_one(&mut **tx)
    .await?;
    let since = match key {
        "12m" => trend.clone(),
        "all" => ALL_SINCE.to_owned(),
        _ => last_30,
    };
    let from = match key {
        "all" => first_company.unwrap_or(&to).to_owned(),
        _ => since.clone(),
    };
    Ok(Period {
        key,
        months: months(&trend),
        since,
        from,
        to,
        trend,
    })
}

/// Twelve consecutive `YYYY-MM` months starting at `first` (`YYYY-MM-DD`).
pub fn months(first: &str) -> Vec<String> {
    let year: i32 = first.get(0..4).and_then(|y| y.parse().ok()).unwrap_or(1970);
    let month: i32 = first.get(5..7).and_then(|m| m.parse().ok()).unwrap_or(1);
    (0..12)
        .map(|step| {
            let index = year * 12 + (month - 1) + step;
            format!("{:04}-{:02}", index / 12, index % 12 + 1)
        })
        .collect()
}

/// Places monthly rows on the twelve months; months without a row are zero.
pub fn series(months: &[String], rows: &[(String, i64)]) -> Vec<i64> {
    months
        .iter()
        .map(|month| {
            rows.iter()
                .filter(|(at, _)| at == month)
                .map(|(_, count)| *count)
                .sum()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_period_key_defaults_to_thirty_days_and_refuses_anything_else() {
        assert_eq!(key(None).unwrap(), "30d");
        assert_eq!(key(Some("12m")).unwrap(), "12m");
        assert_eq!(key(Some("all")).unwrap(), "all");
        for wrong in ["", "7d", "ALL", "30"] {
            assert_eq!(key(Some(wrong)).unwrap_err().1, INVALID);
        }
    }

    #[test]
    fn twelve_months_run_across_the_year_end_oldest_first() {
        let months = months("2025-12-01");
        assert_eq!(months.len(), 12);
        assert_eq!(months[0], "2025-12");
        assert_eq!(months[1], "2026-01");
        assert_eq!(months[11], "2026-11");
        let rows = vec![("2026-01".to_owned(), 4), ("2024-01".to_owned(), 9)];
        let placed = series(&months, &rows);
        assert_eq!(
            (placed[0], placed[1], placed.iter().sum::<i64>()),
            (0, 4, 4)
        );
    }
}
