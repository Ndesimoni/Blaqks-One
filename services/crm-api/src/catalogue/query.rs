use crate::error::{ApiError, ApiResult};
use std::collections::BTreeMap;

#[derive(Default)]
pub struct PublicQuery {
    pub fields: BTreeMap<String, String>,
    pub amenities: Vec<String>,
}
impl PublicQuery {
    pub fn parse(raw: Option<&str>) -> ApiResult<Self> {
        let raw = raw.unwrap_or("");
        if raw.len() > 4096 {
            return Err(ApiError::invalid("The search is too long."));
        }
        let mut result = Self::default();
        for (key, value) in url::form_urlencoded::parse(raw.as_bytes()) {
            if key.len() > 40 || value.len() > 500 {
                return Err(ApiError::invalid("The search is too long."));
            }
            if key == "amenities" {
                result.amenities.extend(
                    value
                        .split(',')
                        .filter(|v| !v.is_empty())
                        .map(str::to_owned),
                );
            } else {
                result
                    .fields
                    .entry(key.into_owned())
                    .or_insert(value.into_owned());
            }
        }
        if result.get("host").is_empty() {
            return Err(ApiError::missing());
        }
        Ok(result)
    }
    pub fn get(&self, key: &str) -> &str {
        self.fields.get(key).map(String::as_str).unwrap_or("")
    }
    pub fn number(&self, key: &str) -> Option<f64> {
        self.get(key).parse().ok()
    }
    pub fn page(&self, total: usize) -> usize {
        self.get("page")
            .parse::<usize>()
            .unwrap_or(1)
            .clamp(1, total.div_ceil(12).max(1))
    }
}
