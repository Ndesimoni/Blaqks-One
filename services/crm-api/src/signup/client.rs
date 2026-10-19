//! Canonical client identity for sign-up budgets (packet R2). The socket peer is the
//! default; a forwarded address is used only when that peer is in the explicit trusted
//! proxy allowlist. Only a keyed digest is stored or logged.
use crate::error::{ApiError, ApiResult};
use axum::http::{HeaderMap, HeaderName};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    net::{IpAddr, SocketAddr},
};

pub struct ClientKeys {
    trusted: HashSet<IpAddr>,
    header: HeaderName,
    secret: Vec<u8>,
}

impl ClientKeys {
    pub fn new(trusted: &str, header: &str, secret: &str) -> Result<Self, String> {
        let mut proxies = HashSet::new();
        for value in trusted.split(',').map(str::trim).filter(|v| !v.is_empty()) {
            let address: IpAddr = value
                .parse()
                .map_err(|_| "CRM_TRUSTED_PROXIES must list IP addresses.")?;
            proxies.insert(address);
        }
        Ok(Self {
            trusted: proxies,
            header: HeaderName::from_bytes(header.as_bytes())
                .map_err(|_| "CRM_TRUSTED_CLIENT_HEADER is invalid.")?,
            secret: secret.as_bytes().to_vec(),
        })
    }

    /// A stable keyed digest for this caller. Duplicate, comma-joined or malformed
    /// forwarded values from a trusted proxy are refused rather than guessed.
    pub fn digest(&self, peer: SocketAddr, headers: &HeaderMap) -> ApiResult<String> {
        let address = self.address(peer, headers)?;
        let mut hash = Sha256::new();
        hash.update(&self.secret);
        hash.update([0]);
        hash.update(address.to_string().as_bytes());
        Ok(hash.finalize().iter().map(|b| format!("{b:02x}")).collect())
    }

    fn address(&self, peer: SocketAddr, headers: &HeaderMap) -> ApiResult<IpAddr> {
        if !self.trusted.contains(&peer.ip()) {
            return Ok(peer.ip());
        }
        let mut values = headers.get_all(&self.header).iter();
        let Some(value) = values.next() else {
            return Ok(peer.ip());
        };
        if values.next().is_some() {
            return Err(forwarding());
        }
        let text = value.to_str().map_err(|_| forwarding())?;
        if text.contains(',') {
            return Err(forwarding());
        }
        text.trim().parse().map_err(|_| forwarding())
    }
}

fn forwarding() -> ApiError {
    ApiError::invalid("The forwarded client address is invalid.")
}

#[cfg(test)]
#[path = "client_tests.rs"]
mod tests;
