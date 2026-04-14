use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::time::Duration;

use crate::license_pubkey::LICENSE_PUBLIC_KEY;

const LICENSE_API_BASE: &str = "https://substratesystems.io/api/license";
const HTTP_TIMEOUT: Duration = Duration::from_secs(10);
const REVALIDATION_WINDOW_DAYS: i64 = 30;

// ---------------------------------------------------------------------------
// Public types (Tauri bridge)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub activated: bool,
    pub key: Option<String>,
    pub instance_id: Option<String>,
    pub activated_at: Option<String>,
    pub machine_name: Option<String>,
    pub validation_error: Option<String>,
}

impl LicenseStatus {
    pub fn inactive() -> Self {
        Self {
            activated: false,
            key: None,
            instance_id: None,
            activated_at: None,
            machine_name: None,
            validation_error: None,
        }
    }

    pub fn inactive_with_error(error: String) -> Self {
        Self {
            activated: false,
            key: None,
            instance_id: None,
            activated_at: None,
            machine_name: None,
            validation_error: Some(error),
        }
    }
}

/// Cached license data stored to disk. All fields are required; a cache
/// lacking any of them (e.g. a pre-migration cache without `signature`) will
/// fail to deserialize and be deleted by `read_cache`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseCache {
    pub key: String,
    pub instance_id: String,
    pub fingerprint: String,
    pub activated_at: String,
    pub expires_at: String,
    pub signature: String,
    pub last_validated_at: String,
}

// ---------------------------------------------------------------------------
// Wire types (substratesystems.io API — snake_case)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
struct ActivateRequest<'a> {
    key: &'a str,
    fingerprint: &'a str,
    machine_name: &'a str,
}

#[derive(Debug, Serialize)]
struct ValidateRequest<'a> {
    key: &'a str,
    fingerprint: &'a str,
    instance_id: &'a str,
}

#[derive(Debug, Serialize)]
struct DeactivateRequest<'a> {
    key: &'a str,
    instance_id: &'a str,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct ActivateResponse {
    activated: Option<bool>,
    instance_id: Option<String>,
    activated_at: Option<String>,
    expires_at: Option<String>,
    signature: Option<String>,
    error: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct ValidateResponse {
    valid: Option<bool>,
    activated_at: Option<String>,
    expires_at: Option<String>,
    signature: Option<String>,
    error: Option<String>,
    message: Option<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct DeactivateResponse {
    deactivated: Option<bool>,
    error: Option<String>,
    message: Option<String>,
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/// Canonical signing payload: `sha256(key || fingerprint || activated_at || expires_at)`.
///
/// Fields are concatenated as UTF-8 bytes with NO separator, in the fixed order
/// above. `expires_at` is the empty string for perpetual licenses. The server's
/// signing code MUST produce the same byte layout — this is the single shared
/// contract between the GUI and the Vercel license API.
fn canonical_hash(key: &str, fingerprint: &str, activated_at: &str, expires_at: &str) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(key.as_bytes());
    h.update(fingerprint.as_bytes());
    h.update(activated_at.as_bytes());
    h.update(expires_at.as_bytes());
    let out = h.finalize();
    let mut hash = [0u8; 32];
    hash.copy_from_slice(&out);
    hash
}

fn verify_signature_with_key(
    pubkey: &VerifyingKey,
    key: &str,
    fingerprint: &str,
    activated_at: &str,
    expires_at: &str,
    signature_b64: &str,
) -> Result<(), String> {
    let sig_bytes = B64
        .decode(signature_b64.as_bytes())
        .map_err(|e| format!("signature is not valid base64: {}", e))?;
    let sig = Signature::from_slice(&sig_bytes)
        .map_err(|e| format!("signature has invalid length: {}", e))?;
    let hash = canonical_hash(key, fingerprint, activated_at, expires_at);
    pubkey
        .verify_strict(&hash, &sig)
        .map_err(|e| format!("signature verification failed: {}", e))
}

fn default_verifying_key() -> VerifyingKey {
    VerifyingKey::from_bytes(&LICENSE_PUBLIC_KEY)
        .expect("embedded LICENSE_PUBLIC_KEY must be a valid Ed25519 public key")
}

fn verify_activation_signature(
    key: &str,
    fingerprint: &str,
    activated_at: &str,
    expires_at: &str,
    signature_b64: &str,
) -> Result<(), String> {
    verify_signature_with_key(
        &default_verifying_key(),
        key,
        fingerprint,
        activated_at,
        expires_at,
        signature_b64,
    )
}

// ---------------------------------------------------------------------------
// Machine fingerprint
// ---------------------------------------------------------------------------

/// Compute a SHA-256 machine fingerprint from Windows registry values and hostname.
pub fn compute_fingerprint() -> Result<String, String> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let crypto_key = hklm
        .open_subkey("SOFTWARE\\Microsoft\\Cryptography")
        .map_err(|e| format!("Failed to open Cryptography registry key: {}", e))?;
    let machine_guid: String = crypto_key
        .get_value("MachineGuid")
        .map_err(|e| format!("Failed to read MachineGuid: {}", e))?;

    let hostname = hostname::get()
        .map_err(|e| format!("Failed to get hostname: {}", e))?
        .to_string_lossy()
        .to_string();

    let nt_key = hklm
        .open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion")
        .map_err(|e| format!("Failed to open Windows NT registry key: {}", e))?;
    let install_date: u32 = nt_key
        .get_value("InstallDate")
        .map_err(|e| format!("Failed to read InstallDate: {}", e))?;

    let mut hasher = Sha256::new();
    hasher.update(machine_guid.as_bytes());
    hasher.update(hostname.as_bytes());
    hasher.update(install_date.to_le_bytes());
    Ok(hex::encode(hasher.finalize()))
}

fn current_machine_name() -> Option<String> {
    hostname::get()
        .ok()
        .map(|h| h.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
}

// ---------------------------------------------------------------------------
// License cache (disk persistence)
// ---------------------------------------------------------------------------

/// Path to the cache file. Uses the bundle identifier so the NSIS uninstaller
/// cleans it up on uninstall.
pub fn cache_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not determine APPDATA directory".to_string())?;
    Ok(config_dir
        .join("com.substratesystems.endstate")
        .join("license.json"))
}

/// Read the cached license. A cache that fails to deserialize (e.g. a
/// pre-migration cache without `signature`) is deleted and treated as absent.
pub fn read_cache() -> Result<Option<LicenseCache>, String> {
    let path = cache_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read license cache: {}", e))?;
    match serde_json::from_str::<LicenseCache>(&data) {
        Ok(cache) => Ok(Some(cache)),
        Err(_) => {
            let _ = std::fs::remove_file(&path);
            Ok(None)
        }
    }
}

pub fn write_cache(cache: &LicenseCache) -> Result<(), String> {
    let path = cache_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create license directory: {}", e))?;
    }
    let data = serde_json::to_string_pretty(cache)
        .map_err(|e| format!("Failed to serialize license cache: {}", e))?;
    std::fs::write(&path, data).map_err(|e| format!("Failed to write license cache: {}", e))?;
    Ok(())
}

pub fn delete_cache() -> Result<(), String> {
    let path = cache_path()?;
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete license cache: {}", e))?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))
}

async fn api_activate(
    key: &str,
    fingerprint: &str,
    machine_name: &str,
) -> Result<ActivateResponse, String> {
    let body = ActivateRequest {
        key,
        fingerprint,
        machine_name,
    };
    let resp = http_client()?
        .post(format!("{}/activate", LICENSE_API_BASE))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Activation request failed: {}", e))?;
    resp.json::<ActivateResponse>()
        .await
        .map_err(|e| format!("Failed to parse activation response: {}", e))
}

async fn api_validate(
    key: &str,
    fingerprint: &str,
    instance_id: &str,
) -> Result<ValidateResponse, String> {
    let body = ValidateRequest {
        key,
        fingerprint,
        instance_id,
    };
    let resp = http_client()?
        .post(format!("{}/validate", LICENSE_API_BASE))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Validation request failed: {}", e))?;
    resp.json::<ValidateResponse>()
        .await
        .map_err(|e| format!("Failed to parse validation response: {}", e))
}

async fn api_deactivate(
    key: &str,
    instance_id: &str,
) -> Result<DeactivateResponse, String> {
    let body = DeactivateRequest { key, instance_id };
    let resp = http_client()?
        .post(format!("{}/deactivate", LICENSE_API_BASE))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Deactivation request failed: {}", e))?;
    resp.json::<DeactivateResponse>()
        .await
        .map_err(|e| format!("Failed to parse deactivation response: {}", e))
}

// ---------------------------------------------------------------------------
// Pure decision logic (testable without HTTP)
// ---------------------------------------------------------------------------

#[derive(Debug, PartialEq)]
enum WindowState {
    Fresh,
    Stale,
}

fn window_state(last_validated_at: &str, now: DateTime<Utc>) -> WindowState {
    match DateTime::parse_from_rfc3339(last_validated_at) {
        Ok(dt) => {
            let age = now.signed_duration_since(dt.with_timezone(&Utc));
            if age.num_days() < REVALIDATION_WINDOW_DAYS {
                WindowState::Fresh
            } else {
                WindowState::Stale
            }
        }
        Err(_) => WindowState::Stale,
    }
}

#[derive(Debug)]
enum CheckDecision {
    /// Online re-validation succeeded — write new cache, return active.
    RefreshAndActivate(LicenseCache),
    /// Network unreachable within window — trust existing cache.
    ActiveFromCache,
    /// Server said invalid — delete cache, deny.
    InvalidateCache(String),
    /// Network unreachable past window, or re-signed response failed verification
    /// past window — keep cache (user can retry), deny.
    KeepCacheAndDeny(String),
}

fn decide_check(
    cache: &LicenseCache,
    online: Result<ValidateResponse, String>,
    now: DateTime<Utc>,
    verifying_key: &VerifyingKey,
) -> CheckDecision {
    match online {
        Ok(resp) if resp.valid == Some(true) => {
            let activated_at = resp
                .activated_at
                .unwrap_or_else(|| cache.activated_at.clone());
            let expires_at = resp.expires_at.unwrap_or_else(|| cache.expires_at.clone());
            let signature = resp.signature.unwrap_or_else(|| cache.signature.clone());

            if verify_signature_with_key(
                verifying_key,
                &cache.key,
                &cache.fingerprint,
                &activated_at,
                &expires_at,
                &signature,
            )
            .is_err()
            {
                return match window_state(&cache.last_validated_at, now) {
                    WindowState::Fresh => CheckDecision::ActiveFromCache,
                    WindowState::Stale => CheckDecision::KeepCacheAndDeny(
                        "License must be re-validated online".to_string(),
                    ),
                };
            }

            let new_cache = LicenseCache {
                key: cache.key.clone(),
                instance_id: cache.instance_id.clone(),
                fingerprint: cache.fingerprint.clone(),
                activated_at,
                expires_at,
                signature,
                last_validated_at: now.to_rfc3339(),
            };
            CheckDecision::RefreshAndActivate(new_cache)
        }
        Ok(resp) => {
            let msg = resp
                .message
                .or(resp.error)
                .unwrap_or_else(|| "License validation failed".to_string());
            CheckDecision::InvalidateCache(msg)
        }
        Err(_) => match window_state(&cache.last_validated_at, now) {
            WindowState::Fresh => CheckDecision::ActiveFromCache,
            WindowState::Stale => CheckDecision::KeepCacheAndDeny(
                "License must be re-validated online".to_string(),
            ),
        },
    }
}

// ---------------------------------------------------------------------------
// Tauri command implementations
// ---------------------------------------------------------------------------

pub async fn activate(key: String) -> Result<LicenseStatus, String> {
    let fingerprint = compute_fingerprint()?;
    let machine_name = current_machine_name().unwrap_or_default();

    let resp = api_activate(&key, &fingerprint, &machine_name).await?;

    if resp.activated != Some(true) {
        let msg = resp
            .message
            .or(resp.error)
            .unwrap_or_else(|| "Activation failed".to_string());
        return Ok(LicenseStatus::inactive_with_error(msg));
    }

    let instance_id = resp
        .instance_id
        .ok_or_else(|| "Activation response missing instance_id".to_string())?;
    let activated_at = resp
        .activated_at
        .ok_or_else(|| "Activation response missing activated_at".to_string())?;
    let expires_at = resp.expires_at.unwrap_or_default();
    let signature = resp
        .signature
        .ok_or_else(|| "Activation response missing signature".to_string())?;

    if let Err(e) =
        verify_activation_signature(&key, &fingerprint, &activated_at, &expires_at, &signature)
    {
        return Ok(LicenseStatus::inactive_with_error(format!(
            "License response failed signature verification: {}",
            e
        )));
    }

    let now = Utc::now().to_rfc3339();
    let cache = LicenseCache {
        key: key.clone(),
        instance_id: instance_id.clone(),
        fingerprint,
        activated_at: activated_at.clone(),
        expires_at,
        signature,
        last_validated_at: now,
    };
    write_cache(&cache)?;

    Ok(LicenseStatus {
        activated: true,
        key: Some(key),
        instance_id: Some(instance_id),
        activated_at: Some(activated_at),
        machine_name: if machine_name.is_empty() {
            None
        } else {
            Some(machine_name)
        },
        validation_error: None,
    })
}

pub async fn check() -> Result<LicenseStatus, String> {
    check_at(Utc::now()).await
}

async fn check_at(now: DateTime<Utc>) -> Result<LicenseStatus, String> {
    let cache = match read_cache()? {
        Some(c) => c,
        None => return Ok(LicenseStatus::inactive()),
    };

    // 1. Signature check on the cache itself.
    if verify_activation_signature(
        &cache.key,
        &cache.fingerprint,
        &cache.activated_at,
        &cache.expires_at,
        &cache.signature,
    )
    .is_err()
    {
        let _ = delete_cache();
        return Ok(LicenseStatus::inactive_with_error(
            "License cache failed signature verification".to_string(),
        ));
    }

    // 2. Fingerprint check.
    let current_fp = compute_fingerprint()?;
    if cache.fingerprint != current_fp {
        return Ok(LicenseStatus::inactive_with_error(
            "License was activated on a different machine".to_string(),
        ));
    }

    let machine_name = current_machine_name();

    // 3. Online re-validation (best-effort). Decision logic is pure.
    let online = api_validate(&cache.key, &cache.fingerprint, &cache.instance_id).await;

    match decide_check(&cache, online, now, &default_verifying_key()) {
        CheckDecision::RefreshAndActivate(new_cache) => {
            write_cache(&new_cache)?;
            Ok(LicenseStatus {
                activated: true,
                key: Some(new_cache.key),
                instance_id: Some(new_cache.instance_id),
                activated_at: Some(new_cache.activated_at),
                machine_name,
                validation_error: None,
            })
        }
        CheckDecision::ActiveFromCache => Ok(LicenseStatus {
            activated: true,
            key: Some(cache.key),
            instance_id: Some(cache.instance_id),
            activated_at: Some(cache.activated_at),
            machine_name,
            validation_error: None,
        }),
        CheckDecision::InvalidateCache(msg) => {
            let _ = delete_cache();
            Ok(LicenseStatus::inactive_with_error(msg))
        }
        CheckDecision::KeepCacheAndDeny(msg) => Ok(LicenseStatus::inactive_with_error(msg)),
    }
}

pub async fn deactivate() -> Result<(), String> {
    let cache = read_cache()?.ok_or_else(|| "No active license to deactivate".to_string())?;

    let resp = api_deactivate(&cache.key, &cache.instance_id).await?;

    if resp.deactivated == Some(true) {
        delete_cache()?;
        Ok(())
    } else {
        let msg = resp
            .message
            .or(resp.error)
            .unwrap_or_else(|| "Deactivation failed".to_string());
        Err(msg)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    // Deterministic test keypair — never used in production.
    const TEST_SEED: [u8; 32] = [7u8; 32];

    fn test_keypair() -> (SigningKey, VerifyingKey) {
        let sk = SigningKey::from_bytes(&TEST_SEED);
        let vk = sk.verifying_key();
        (sk, vk)
    }

    fn sign_canonical(
        sk: &SigningKey,
        key: &str,
        fingerprint: &str,
        activated_at: &str,
        expires_at: &str,
    ) -> String {
        let hash = canonical_hash(key, fingerprint, activated_at, expires_at);
        let sig = sk.sign(&hash);
        B64.encode(sig.to_bytes())
    }

    fn rfc3339(ago_days: i64, now: DateTime<Utc>) -> String {
        (now - chrono::Duration::days(ago_days)).to_rfc3339()
    }

    // ---- Serialization ----

    #[test]
    fn test_license_status_serialization() {
        let status = LicenseStatus {
            activated: true,
            key: Some("test-key-123".to_string()),
            instance_id: Some("inst-456".to_string()),
            activated_at: Some("2026-01-01T00:00:00Z".to_string()),
            machine_name: Some("MY-PC".to_string()),
            validation_error: None,
        };
        let json = serde_json::to_value(&status).unwrap();
        assert_eq!(json["activated"], true);
        assert_eq!(json["key"], "test-key-123");
        assert_eq!(json["instanceId"], "inst-456");
        assert_eq!(json["activatedAt"], "2026-01-01T00:00:00Z");
        assert_eq!(json["machineName"], "MY-PC");
        assert!(json["validationError"].is_null());
    }

    #[test]
    fn test_license_status_inactive() {
        let status = LicenseStatus::inactive();
        let json = serde_json::to_value(&status).unwrap();
        assert_eq!(json["activated"], false);
        assert!(json["key"].is_null());
    }

    #[test]
    fn test_license_status_inactive_with_error() {
        let status = LicenseStatus::inactive_with_error("Test error".to_string());
        let json = serde_json::to_value(&status).unwrap();
        assert_eq!(json["activated"], false);
        assert_eq!(json["validationError"], "Test error");
    }

    #[test]
    fn test_cache_serialization_camel_case_all_fields() {
        let cache = LicenseCache {
            key: "k".into(),
            instance_id: "i".into(),
            fingerprint: "f".into(),
            activated_at: "a".into(),
            expires_at: "e".into(),
            signature: "s".into(),
            last_validated_at: "l".into(),
        };
        let json = serde_json::to_value(&cache).unwrap();
        for field in [
            "key",
            "instanceId",
            "fingerprint",
            "activatedAt",
            "expiresAt",
            "signature",
            "lastValidatedAt",
        ] {
            assert!(
                json.get(field).is_some(),
                "missing expected camelCase field: {}",
                field
            );
        }
        for field in ["instance_id", "activated_at", "expires_at", "last_validated_at"] {
            assert!(json.get(field).is_none(), "found snake_case field: {}", field);
        }
    }

    #[test]
    fn test_cache_roundtrip() {
        let cache = LicenseCache {
            key: "test-key".into(),
            instance_id: "test-instance".into(),
            fingerprint: "abc123".into(),
            activated_at: "2026-01-01T00:00:00Z".into(),
            expires_at: "2027-01-01T00:00:00Z".into(),
            signature: "c2lnLWJhc2U2NA==".into(),
            last_validated_at: "2026-01-02T00:00:00Z".into(),
        };
        let json = serde_json::to_string(&cache).unwrap();
        let parsed: LicenseCache = serde_json::from_str(&json).unwrap();
        assert_eq!(cache, parsed);
    }

    #[test]
    fn test_cache_missing_signature_field_fails_to_parse() {
        // A pre-migration cache shape — no signature, no expiresAt, no lastValidatedAt.
        let legacy = r#"{
            "key": "k",
            "instanceId": "i",
            "fingerprint": "f",
            "activatedAt": "2026-01-01T00:00:00Z"
        }"#;
        let parsed = serde_json::from_str::<LicenseCache>(legacy);
        assert!(
            parsed.is_err(),
            "legacy cache without signature must fail to deserialize"
        );
    }

    // ---- Canonical hash + signature verification (known-answer) ----

    #[test]
    fn test_canonical_hash_is_stable_and_field_ordered() {
        let a = canonical_hash("k", "f", "a", "e");
        let b = canonical_hash("k", "f", "a", "e");
        assert_eq!(a, b, "canonical_hash must be deterministic");

        // Swapping two fields must change the hash (ordering matters).
        let c = canonical_hash("f", "k", "a", "e");
        assert_ne!(a, c, "canonical_hash must be order-sensitive");
    }

    #[test]
    fn test_verify_signature_valid() {
        let (sk, vk) = test_keypair();
        let sig = sign_canonical(&sk, "mykey", "myfp", "2026-01-01T00:00:00Z", "");
        assert!(
            verify_signature_with_key(&vk, "mykey", "myfp", "2026-01-01T00:00:00Z", "", &sig)
                .is_ok()
        );
    }

    #[test]
    fn test_verify_signature_tampered_payload() {
        let (sk, vk) = test_keypair();
        let sig = sign_canonical(&sk, "mykey", "myfp", "2026-01-01T00:00:00Z", "");
        // Tamper: change fingerprint.
        assert!(
            verify_signature_with_key(&vk, "mykey", "OTHER", "2026-01-01T00:00:00Z", "", &sig)
                .is_err()
        );
    }

    #[test]
    fn test_verify_signature_tampered_signature() {
        let (sk, vk) = test_keypair();
        let sig = sign_canonical(&sk, "mykey", "myfp", "2026-01-01T00:00:00Z", "");
        // Flip the last base64 character.
        let mut tampered = sig.clone();
        let last = tampered.pop().unwrap();
        tampered.push(if last == 'A' { 'B' } else { 'A' });
        let res =
            verify_signature_with_key(&vk, "mykey", "myfp", "2026-01-01T00:00:00Z", "", &tampered);
        assert!(res.is_err());
    }

    #[test]
    fn test_verify_signature_wrong_key() {
        let (sk, _) = test_keypair();
        let sig = sign_canonical(&sk, "mykey", "myfp", "2026-01-01T00:00:00Z", "");
        // Verify against a different public key (the production one).
        let wrong_vk = default_verifying_key();
        assert!(
            verify_signature_with_key(&wrong_vk, "mykey", "myfp", "2026-01-01T00:00:00Z", "", &sig)
                .is_err()
        );
    }

    #[test]
    fn test_verify_signature_bad_base64() {
        let (_sk, vk) = test_keypair();
        assert!(
            verify_signature_with_key(&vk, "k", "f", "a", "e", "!!!not-base64!!!").is_err()
        );
    }

    #[test]
    fn test_verify_signature_wrong_length() {
        let (_sk, vk) = test_keypair();
        // Valid base64, wrong length for Ed25519 (expects 64 bytes).
        let short = B64.encode([0u8; 32]);
        assert!(verify_signature_with_key(&vk, "k", "f", "a", "e", &short).is_err());
    }

    #[test]
    fn test_default_verifying_key_loads() {
        // Just ensure the embedded public key decodes.
        let _ = default_verifying_key();
    }

    // ---- Window state ----

    #[test]
    fn test_window_state_fresh() {
        let now = Utc::now();
        let five_days_ago = rfc3339(5, now);
        assert_eq!(window_state(&five_days_ago, now), WindowState::Fresh);
    }

    #[test]
    fn test_window_state_stale_at_boundary() {
        let now = Utc::now();
        let thirty_days_ago = rfc3339(30, now);
        assert_eq!(window_state(&thirty_days_ago, now), WindowState::Stale);
    }

    #[test]
    fn test_window_state_stale_past_boundary() {
        let now = Utc::now();
        let sixty_days_ago = rfc3339(60, now);
        assert_eq!(window_state(&sixty_days_ago, now), WindowState::Stale);
    }

    #[test]
    fn test_window_state_unparseable_is_stale() {
        let now = Utc::now();
        assert_eq!(window_state("not a date", now), WindowState::Stale);
    }

    // ---- decide_check ----

    fn make_cache(signed_last_validated: &str) -> LicenseCache {
        let (sk, _) = test_keypair();
        let sig = sign_canonical(&sk, "k", "f", "2026-01-01T00:00:00Z", "");
        LicenseCache {
            key: "k".into(),
            instance_id: "i".into(),
            fingerprint: "f".into(),
            activated_at: "2026-01-01T00:00:00Z".into(),
            expires_at: "".into(),
            signature: sig,
            last_validated_at: signed_last_validated.into(),
        }
    }

    #[test]
    fn test_decide_check_offline_within_window_trusts_cache() {
        let now = Utc::now();
        let cache = make_cache(&rfc3339(5, now));
        let (_, vk) = test_keypair();
        let dec = decide_check(&cache, Err("network".into()), now, &vk);
        assert!(matches!(dec, CheckDecision::ActiveFromCache));
    }

    #[test]
    fn test_decide_check_offline_past_window_keeps_cache_and_denies() {
        let now = Utc::now();
        let cache = make_cache(&rfc3339(45, now));
        let (_, vk) = test_keypair();
        let dec = decide_check(&cache, Err("network".into()), now, &vk);
        match dec {
            CheckDecision::KeepCacheAndDeny(msg) => {
                assert!(msg.contains("re-validated online"));
            }
            other => panic!("expected KeepCacheAndDeny, got {:?}", other),
        }
    }

    #[test]
    fn test_decide_check_server_valid_false_invalidates_cache() {
        let now = Utc::now();
        let cache = make_cache(&rfc3339(5, now));
        let (_, vk) = test_keypair();
        let resp = ValidateResponse {
            valid: Some(false),
            message: Some("Revoked".into()),
            ..Default::default()
        };
        let dec = decide_check(&cache, Ok(resp), now, &vk);
        match dec {
            CheckDecision::InvalidateCache(msg) => assert_eq!(msg, "Revoked"),
            other => panic!("expected InvalidateCache, got {:?}", other),
        }
    }

    #[test]
    fn test_decide_check_server_valid_true_refreshes_cache() {
        let now = Utc::now();
        let cache = make_cache(&rfc3339(45, now));
        let (sk, vk) = test_keypair();
        let new_activated = "2026-04-01T00:00:00Z";
        let new_sig = sign_canonical(&sk, "k", "f", new_activated, "");
        let resp = ValidateResponse {
            valid: Some(true),
            activated_at: Some(new_activated.into()),
            expires_at: Some("".into()),
            signature: Some(new_sig),
            ..Default::default()
        };
        let dec = decide_check(&cache, Ok(resp), now, &vk);
        match dec {
            CheckDecision::RefreshAndActivate(new_cache) => {
                assert_eq!(new_cache.activated_at, new_activated);
                assert_eq!(new_cache.last_validated_at, now.to_rfc3339());
            }
            other => panic!("expected RefreshAndActivate, got {:?}", other),
        }
    }

    #[test]
    fn test_decide_check_server_valid_true_but_bad_signature_within_window_trusts_cache() {
        let now = Utc::now();
        let cache = make_cache(&rfc3339(5, now));
        let (_, vk) = test_keypair();
        let resp = ValidateResponse {
            valid: Some(true),
            activated_at: Some("2026-04-01T00:00:00Z".into()),
            expires_at: Some("".into()),
            signature: Some(B64.encode([0u8; 64])),
            ..Default::default()
        };
        let dec = decide_check(&cache, Ok(resp), now, &vk);
        assert!(matches!(dec, CheckDecision::ActiveFromCache));
    }

    #[test]
    fn test_decide_check_server_valid_true_but_bad_signature_past_window_denies() {
        let now = Utc::now();
        let cache = make_cache(&rfc3339(45, now));
        let (_, vk) = test_keypair();
        let resp = ValidateResponse {
            valid: Some(true),
            activated_at: Some("2026-04-01T00:00:00Z".into()),
            expires_at: Some("".into()),
            signature: Some(B64.encode([0u8; 64])),
            ..Default::default()
        };
        let dec = decide_check(&cache, Ok(resp), now, &vk);
        assert!(matches!(dec, CheckDecision::KeepCacheAndDeny(_)));
    }

    // ---- Fingerprint ----

    #[test]
    fn test_fingerprint_generation() {
        let fp = compute_fingerprint();
        assert!(fp.is_ok(), "Fingerprint generation should succeed on Windows");
        let fp = fp.unwrap();
        assert_eq!(fp.len(), 64);
        assert!(fp.chars().all(|c| c.is_ascii_hexdigit()));
        let fp2 = compute_fingerprint().unwrap();
        assert_eq!(fp, fp2, "Fingerprint should be deterministic");
    }
}
