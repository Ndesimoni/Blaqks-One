//! The dashboard's `inPeriod` figures and twelve-month `trends`. Sign-ins come from the
//! platform event log, so they count from the day BO1d shipped.
use super::{
    gather::Gathered,
    period::{series, Period},
};
use crate::workspaces::platform::CompanyRow;
use serde_json::{json, Value};

pub fn in_period(g: &Gathered, companies: &[CompanyRow], period: &Period) -> Value {
    let since = period.since.as_str();
    let companies_new = companies
        .iter()
        .filter(|company| company.created_on.as_str() >= since)
        .count();
    json!({
        "companiesNew": companies_new,
        "usersNew": g.users_new.0,
        "recordsAdded": g.added.in_period,
        "enquiries": g.enquiries.in_period,
        "enquiriesToLeads": g.enquiries_to_leads,
        "viewings": g.added.viewings,
        "dealsEarned": g.earned.in_period,
        "dealsEarnedValueFils": g.earned.value_in_period,
        "websiteSales": {"deals": g.website_sales.0, "valueFils": g.website_sales.1},
        "interBrokerAgreements": g.between.accepted_in_period,
        "interBrokerValueFils": g.between.value_in_period,
        "emailsSent": g.messages.0,
        "whatsappSent": g.messages.1,
        "chatMessages": g.chat,
        "signIns": g.sign_ins,
    })
}

/// Monthly active users, null for the months before daily activity was first recorded
/// (when nothing is recorded yet, tracking starts this month).
fn tracked(months: &[String], rows: &[(String, i64)], first_day: Option<&str>) -> Vec<Value> {
    let current = months.last().map(String::as_str).unwrap_or_default();
    let start = first_day.and_then(|day| day.get(0..7)).unwrap_or(current);
    months
        .iter()
        .zip(series(months, rows))
        .map(|(month, count)| match month.as_str() < start {
            true => Value::Null,
            false => json!(count),
        })
        .collect()
}

pub fn trends(g: &Gathered, companies: &[CompanyRow], period: &Period) -> Value {
    let months = &period.months;
    let created: Vec<(String, i64)> = companies
        .iter()
        .filter_map(|company| company.created_on.get(0..7))
        .map(|month| (month.to_owned(), 1))
        .collect();
    let earned: Vec<(String, i64)> = g
        .earned
        .months
        .iter()
        .map(|(month, count, _)| (month.clone(), *count))
        .collect();
    let earned_value: Vec<(String, i64)> = g
        .earned
        .months
        .iter()
        .map(|(month, _, value)| (month.clone(), *value))
        .collect();
    json!({
        "months": months,
        "companiesNew": series(months, &created),
        "usersNew": series(months, &g.users_new.1),
        "monthlyActiveUsers": tracked(months, &g.monthly_active, g.tracked_from.as_deref()),
        "recordsAdded": series(months, &g.added.months),
        "enquiries": series(months, &g.enquiries.months),
        "dealsEarned": series(months, &earned),
        "dealsEarnedValueFils": series(months, &earned_value),
        "interBrokerAgreements": series(months, &g.between_months),
    })
}
