//! Anonymous public catalogue: reads only explicit sites/publication projections.
mod build;
mod developer_dubai;
mod developer_emirates;
mod developers;
mod filters;
mod handlers;
mod options;
mod query;
pub mod routes;
mod search;
mod validation;

pub(crate) fn known_developer(id: &str) -> bool {
    developers::all()
        .iter()
        .any(|developer| developer["id"].as_str() == Some(id))
}

#[cfg(test)]
mod tests;
