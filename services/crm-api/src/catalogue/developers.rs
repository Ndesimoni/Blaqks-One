use serde_json::{json, Value};

// Reference names only, never agency partnerships or a complete registry.
pub fn all() -> Vec<Value> {
    super::developer_dubai::REFERENCES.iter().chain(super::developer_emirates::REFERENCES)
 .map(|(id,name,emirate,website)|json!({"id":id,"name":name,"emirate":emirate,"website":website})).collect()
}
