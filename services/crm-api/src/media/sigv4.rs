//! AWS Signature Version 4 for S3 requests (packet F1), built on the existing `hmac` and
//! `sha2` crates instead of an SDK. Pure functions; the clock and secrets come in.
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

pub fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}

fn hmac(key: &[u8], data: &str) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC accepts any key length");
    mac.update(data.as_bytes());
    mac.finalize().into_bytes().to_vec()
}

pub struct Request<'a> {
    pub method: &'a str,
    /// The URI path, already percent-encoded.
    pub path: &'a str,
    /// Lower-case header names with trimmed values; `host` included.
    pub headers: &'a [(&'a str, String)],
    pub payload_hash: &'a str,
    /// `YYYYMMDDTHHMMSSZ`.
    pub amz_date: &'a str,
    pub region: &'a str,
    pub access_key: &'a str,
    pub secret_key: &'a str,
}

/// The `Authorization` header value for a request without a query string.
pub fn authorization(request: &Request<'_>) -> String {
    let mut headers: Vec<&(&str, String)> = request.headers.iter().collect();
    headers.sort_by(|a, b| a.0.cmp(b.0));
    let canonical_headers: String = headers
        .iter()
        .map(|(name, value)| format!("{name}:{}\n", value.trim()))
        .collect();
    let signed: Vec<&str> = headers.iter().map(|(name, _)| *name).collect();
    let signed = signed.join(";");
    let canonical = format!(
        "{}\n{}\n\n{canonical_headers}\n{signed}\n{}",
        request.method, request.path, request.payload_hash
    );
    let date = &request.amz_date[..8];
    let scope = format!("{date}/{}/s3/aws4_request", request.region);
    let to_sign = format!(
        "AWS4-HMAC-SHA256\n{}\n{scope}\n{}",
        request.amz_date,
        sha256_hex(canonical.as_bytes())
    );
    let key = [date, request.region, "s3", "aws4_request"].iter().fold(
        format!("AWS4{}", request.secret_key).into_bytes(),
        |key, part| hmac(&key, part),
    );
    let signature = hex(&hmac(&key, &to_sign));
    format!(
        "AWS4-HMAC-SHA256 Credential={}/{scope}, SignedHeaders={signed}, Signature={signature}",
        request.access_key
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// AWS's published "GET Object" example for Signature Version 4 with S3.
    #[test]
    fn matches_the_aws_get_object_example() {
        let empty = sha256_hex(b"");
        let headers = [
            ("host", "examplebucket.s3.amazonaws.com".to_owned()),
            ("range", "bytes=0-9".to_owned()),
            ("x-amz-content-sha256", empty.clone()),
            ("x-amz-date", "20130524T000000Z".to_owned()),
        ];
        let value = authorization(&Request {
            method: "GET",
            path: "/test.txt",
            headers: &headers,
            payload_hash: &empty,
            amz_date: "20130524T000000Z",
            region: "us-east-1",
            access_key: "AKIAIOSFODNN7EXAMPLE",
            secret_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        });
        assert_eq!(
            value,
            "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, \
             SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, \
             Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
        );
    }
}
