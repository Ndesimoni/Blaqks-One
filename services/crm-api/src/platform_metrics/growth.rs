//! Growth and retention: companies active this month against last month, companies that
//! stopped (someone was active once, nobody in the last 30 days; archived companies are
//! not counted) and the median days from a company's creation to its first earned deal.
use super::gather::Gathered;
use crate::workspaces::platform::CompanyRow;
use serde_json::{json, Value};
use time::{format_description::well_known::Iso8601, Date};

pub fn growth(g: &Gathered, companies: &[CompanyRow], today: &str) -> Value {
    let today = julian(today);
    let stopped = companies
        .iter()
        .filter(|company| company.status != "archived")
        .filter_map(|company| g.activity.iter().find(|a| a.workspace == company.id))
        .filter(|activity| match (julian(&activity.last_day), today) {
            (Some(last), Some(today)) => today - last >= 30,
            _ => false,
        })
        .count();
    let days: Vec<i64> = g
        .first_earned
        .iter()
        .filter_map(|(workspace, first)| {
            let company = companies.iter().find(|company| &company.id == workspace)?;
            Some(i64::from(julian(first)? - julian(&company.created_on)?).max(0))
        })
        .collect();
    json!({
        "companiesActiveThisMonth": g.companies_by_month.0,
        "companiesActiveLastMonth": g.companies_by_month.1,
        "companiesStopped": stopped,
        "medianDaysToFirstEarnedDeal": median(days),
    })
}

/// A `YYYY-MM-DD` day as a day number.
fn julian(text: &str) -> Option<i32> {
    Date::parse(text, &Iso8601::DATE)
        .ok()
        .map(Date::to_julian_day)
}

/// The middle value (the mean of the two middle values for an even count), or `None` when
/// there is nothing to measure.
pub fn median(mut values: Vec<i64>) -> Option<f64> {
    if values.is_empty() {
        return None;
    }
    values.sort_unstable();
    let middle = values.len() / 2;
    let pair = match values.len() % 2 {
        1 => (values[middle], values[middle]),
        _ => (values[middle - 1], values[middle]),
    };
    Some((pair.0 + pair.1) as f64 / 2.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_median_is_none_without_data_and_the_middle_otherwise() {
        assert_eq!(median(vec![]), None);
        assert_eq!(median(vec![9, 1, 5]), Some(5.0));
        assert_eq!(median(vec![10, 2, 4, 7]), Some(5.5));
    }

    #[test]
    fn days_are_counted_between_calendar_dates() {
        let days = julian("2026-03-01").unwrap() - julian("2026-02-01").unwrap();
        assert_eq!(days, 28);
        assert_eq!(julian("not a day"), None);
    }
}
