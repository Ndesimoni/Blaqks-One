use super::{Failure, Google, SCOPES};
use crate::store::{now, Tokens};
use reqwest::StatusCode;
use serde_json::Value;

impl Google {
    pub async fn exchange(
        &self,
        client_id: &str,
        secret: &str,
        code: &str,
        verifier: &str,
        redirect: &str,
    ) -> Result<Tokens, Failure> {
        let response = self
            .client
            .post(&self.token_url)
            .form(&[
                ("client_id", client_id),
                ("client_secret", secret),
                ("code", code),
                ("code_verifier", verifier),
                ("redirect_uri", redirect),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await
            .map_err(|_| Failure::network())?;
        if !response.status().is_success() {
            return Err(Failure::auth());
        }
        let body: Value = response.json().await.map_err(|_| Failure::network())?;
        let access = body["access_token"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or_else(Failure::auth)?;
        let refresh = body["refresh_token"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or_else(Failure::auth)?;
        let granted = body["scope"].as_str().unwrap_or("");
        if !SCOPES
            .split_whitespace()
            .all(|scope| granted.split_whitespace().any(|s| s == scope))
        {
            return Err(Failure::auth());
        }
        Ok(Tokens {
            access: access.into(),
            refresh: refresh.into(),
            expires: now() + body["expires_in"].as_i64().unwrap_or(3600),
        })
    }
    pub async fn refresh(
        &self,
        tokens: &mut Tokens,
        client_id: &str,
        secret: &str,
    ) -> Result<(), Failure> {
        if tokens.expires > now() + 60 {
            return Ok(());
        }
        let response = self
            .client
            .post(&self.token_url)
            .form(&[
                ("client_id", client_id),
                ("client_secret", secret),
                ("refresh_token", tokens.refresh.as_str()),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|_| Failure::network())?;
        if !response.status().is_success() {
            return Err(
                if response.status().is_server_error()
                    || response.status() == StatusCode::TOO_MANY_REQUESTS
                {
                    Failure::network()
                } else {
                    Failure::auth()
                },
            );
        }
        let body: Value = response.json().await.map_err(|_| Failure::network())?;
        tokens.access = body["access_token"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or_else(Failure::auth)?
            .into();
        tokens.expires = now() + body["expires_in"].as_i64().unwrap_or(3600);
        Ok(())
    }
    pub async fn revoke(&self, tokens: &Tokens) -> Result<(), Failure> {
        let response = self
            .client
            .post(&self.revoke_url)
            .form(&[("token", &tokens.refresh)])
            .send()
            .await
            .map_err(|_| Failure::network())?;
        if response.status().is_success() || response.status() == StatusCode::BAD_REQUEST {
            Ok(())
        } else {
            Err(Failure::network())
        }
    }
}
