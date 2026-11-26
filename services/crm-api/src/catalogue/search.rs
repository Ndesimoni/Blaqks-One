use super::{filters, query::PublicQuery, validation};
use serde_json::{json, Value};
use std::cmp::Ordering;

fn text<'a>(value: &'a Value, key: &str) -> &'a str {
    value[key].as_str().unwrap_or("")
}
pub fn sort(items: &mut [Value], mode: &str) {
    items.sort_by(|a, b| match mode {
        "name" => text(a, "title").cmp(text(b, "title")),
        "price-asc" | "price-desc" | "size-asc" | "size-desc" => {
            let key = if mode.starts_with("price") {
                "price"
            } else {
                "size"
            };
            let order = a[key]
                .as_f64()
                .partial_cmp(&b[key].as_f64())
                .unwrap_or(Ordering::Equal);
            if mode.ends_with("desc") {
                order.reverse()
            } else {
                order
            }
        }
        _ => {
            let date = |v| {
                time::OffsetDateTime::parse(
                    text(v, "publishedAt"),
                    &time::format_description::well_known::Rfc3339,
                )
                .ok()
            };
            date(b).cmp(&date(a))
        }
    });
}
pub fn listings(catalogue: &Value, q: &PublicQuery) -> Value {
    let errors = validation::errors(q, catalogue);
    let mut items: Vec<Value> = catalogue["listings"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|p| errors.is_empty() && filters::matches(p, q))
        .cloned()
        .collect();
    sort(&mut items, q.get("sort"));
    let total = items.len();
    let page = q.page(total);
    let items: Vec<Value> = items.into_iter().skip((page - 1) * 12).take(12).collect();
    json!({"data":items,"included":super::build::included(catalogue,items.clone()),"pagination":{"total":total,"page":page,"pageSize":12},"errors":errors})
}
pub fn directory(catalogue: &Value, resource: &str, q: &PublicQuery) -> Value {
    let mut entries: Vec<Value> = catalogue[resource]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|v| {
            let term = q.get("q").trim().to_lowercase();
            let emirate = text(v, "emirate").to_lowercase().replace(' ', "-");
            (term.is_empty() || text(v, "name").to_lowercase().contains(&term))
                && (q.get("emirate").is_empty() || emirate == q.get("emirate"))
                && (q.get("availability") != "available"
                    || v["publicListingCount"].as_u64().unwrap_or(0) > 0)
        })
        .cloned()
        .collect();
    entries.sort_by(|a, b| text(a, "name").cmp(text(b, "name")));
    let total = entries.len();
    let page = q.page(total);
    let entries: Vec<Value> = entries.into_iter().skip((page - 1) * 12).take(12).collect();
    json!({"data":entries,"included":super::build::included(catalogue,Vec::new()),"pagination":{"total":total,"page":page,"pageSize":12}})
}
