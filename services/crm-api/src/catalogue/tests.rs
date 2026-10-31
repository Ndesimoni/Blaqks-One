use super::{filters, query::PublicQuery, search, validation};
use serde_json::{json, Value};

fn q(text: &str) -> PublicQuery {
    PublicQuery::parse(Some(&format!("host=public.test&{text}"))).unwrap()
}
fn catalogue() -> Value {
    json!({"listings":[{"id":"1","title":"Home","purpose":"buy","price":2500000,"size":1100,"category":"residential","bedrooms":0,"bathrooms":1,"parking":1,"amenities":["pool","gym"],"emirate":"dubai","area":"marina","publishedAt":"2026-10-28T00:00:00Z"}],"companies":[],"agents":[],"areas":[{"id":"marina","emirate":"dubai"}],"developers":[]})
}
#[test]
fn invalid_budgets_and_mixed_purposes_never_widen() {
    let source = catalogue();
    for query in [
        "minPrice=100",
        "purpose=buy&minPrice=3&maxPrice=1",
        "purpose=rent&guests=2",
        "purpose=buy&minPrice=NaN",
        "emirate=dubai&area=unknown",
    ] {
        let result = search::listings(&source, &q(query));
        assert_eq!(result["pagination"]["total"], 0);
        assert!(!result["errors"].as_array().unwrap().is_empty());
    }
}
#[test]
fn inclusive_ranges_studio_multiple_amenities_and_empty_emirates() {
    let source = catalogue();
    let query=q("purpose=buy&minPrice=2500000&maxPrice=2500000&bedrooms=studio&amenities=pool&amenities=gym");
    assert!(validation::errors(&query, &source).is_empty());
    assert!(filters::matches(&source["listings"][0], &query));
    assert_eq!(query.amenities.len(), 2);
    assert_eq!(
        search::listings(&source, &q("emirate=fujairah"))["pagination"]["total"],
        0
    );
    assert_eq!(
        search::listings(&source, &q("page=999"))["pagination"]["page"],
        1
    );
}
#[test]
fn malformed_or_oversized_queries_fail_closed() {
    assert!(PublicQuery::parse(Some("purpose=buy")).is_err());
    assert!(PublicQuery::parse(Some(&"a".repeat(4097))).is_err());
    assert_eq!(q("purpose=buy&purpose=rent").get("purpose"), "buy");
}
