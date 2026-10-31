use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

pub const COLUMNS: &str =
    "id,workspace,kind,host,name,theme,active,entitled,licence_verified,company,content,version";
#[derive(Clone, Debug, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteRow {
    pub id: Uuid,
    pub workspace: Option<String>,
    pub kind: String,
    pub host: String,
    pub name: String,
    pub theme: String,
    pub active: bool,
    pub entitled: bool,
    pub licence_verified: bool,
    pub company: Value,
    pub content: Value,
    pub version: i64,
}
impl SiteRow {
    pub fn dto(&self) -> Value {
        // Published links are re-checked as they are served (docs/website-social-links.md).
        let mut content = self.content.clone();
        if let Some(fields) = content.as_object_mut() {
            match super::social::public(fields.get("social"), false) {
                Some(links) => fields.insert("social".into(), links),
                None => fields.remove("social"),
            };
        }
        json!({"id":self.id,"kind":self.kind,"name":self.name,"theme":self.theme,
            "company":self.workspace.as_ref().map(|_|self.id),"content":content})
    }
}
#[derive(Clone, Debug, FromRow, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileRow {
    pub id: Uuid,
    pub workspace: String,
    pub member: Uuid,
    pub body: Value,
    pub consent: bool,
    pub can_publish: bool,
    pub active: bool,
    pub version: i64,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SiteInput {
    pub version: i64,
    pub name: String,
    pub theme: String,
    pub slug: Option<String>,
    pub host: Option<String>,
    pub company: Option<Value>,
    #[serde(default)]
    pub content: Value,
    #[serde(default = "yes")]
    pub active: bool,
}
fn yes() -> bool {
    true
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EligibilityInput {
    pub version: i64,
    pub entitled: bool,
    pub licence_verified: bool,
    pub host: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProfileInput {
    pub version: i64,
    pub name: String,
    pub specialty: String,
    pub public_whats_app: Option<String>,
    pub public_email: Option<String>,
    /// The member's own social links (docs/website-social-links.md).
    #[serde(default)]
    pub social: Option<Value>,
    pub consent: bool,
    pub active: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GrantInput {
    pub version: i64,
    pub can_publish: bool,
}
