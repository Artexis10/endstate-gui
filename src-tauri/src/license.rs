use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

/// License status returned to the frontend via Tauri commands.
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

/// Cached license data stored to disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseCache {
    pub key: String,
    pub instance_id: String,
    pub fingerprint: String,
    pub activated_at: String,
}

/// LemonSqueezy activation/validation API response (relevant fields).
#[derive(Debug, Deserialize)]
struct LemonSqueezyResponse {
    activated: Option<bool>,
    valid: Option<bool>,
    deactivated: Option<bool>,
    instance: Option<LemonSqueezyInstance>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LemonSqueezyInstance {
    id: String,
}

// ---------------------------------------------------------------------------
// Machine fingerprint
// ---------------------------------------------------------------------------

/// Compute a SHA-256 machine fingerprint from Windows registry values and hostname.
///
/// Composite of:
/// - `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`
/// - Computer name (hostname)
/// - `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\InstallDate`
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

    let hostname =
        hostname::get()
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
    let result = hasher.finalize();

    Ok(hex::encode(result))
}

// ---------------------------------------------------------------------------
// License cache (disk persistence)
// ---------------------------------------------------------------------------

/// Return the path to the license cache file.
///
/// Uses `%APPDATA%/com.substratesystems.endstate/license.json` to match
/// the bundle identifier that the NSIS uninstaller cleans up.
/// Previously used `%APPDATA%/Endstate/` which the uninstaller never touched,
/// causing stale license caches to survive install/uninstall cycles.
pub fn cache_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not determine APPDATA directory".to_string())?;
    Ok(config_dir
        .join("com.substratesystems.endstate")
        .join("license.json"))
}

/// Read the cached license from disk. Returns `None` if the file doesn't exist.
pub fn read_cache() -> Result<Option<LicenseCache>, String> {
    let path = cache_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let data =
        std::fs::read_to_string(&path).map_err(|e| format!("Failed to read license cache: {}", e))?;
    let cache: LicenseCache =
        serde_json::from_str(&data).map_err(|e| format!("Failed to parse license cache: {}", e))?;
    Ok(Some(cache))
}

/// Write the license cache to disk, creating the parent directory if needed.
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

/// Delete the license cache from disk.
pub fn delete_cache() -> Result<(), String> {
    let path = cache_path()?;
    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete license cache: {}", e))?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// LemonSqueezy API calls
// ---------------------------------------------------------------------------

const LEMONSQUEEZY_API_BASE: &str = "https://api.lemonsqueezy.com/v1/licenses";

/// Activate a license key with LemonSqueezy.
async fn api_activate(key: &str, instance_name: &str) -> Result<LemonSqueezyResponse, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/activate", LEMONSQUEEZY_API_BASE))
        .form(&[("license_key", key), ("instance_name", instance_name)])
        .send()
        .await
        .map_err(|e| format!("Activation request failed: {}", e))?;

    resp.json::<LemonSqueezyResponse>()
        .await
        .map_err(|e| format!("Failed to parse activation response: {}", e))
}

/// Validate a license key with LemonSqueezy.
async fn api_validate(key: &str, instance_id: &str) -> Result<LemonSqueezyResponse, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/validate", LEMONSQUEEZY_API_BASE))
        .form(&[("license_key", key), ("instance_id", instance_id)])
        .send()
        .await
        .map_err(|e| format!("Validation request failed: {}", e))?;

    resp.json::<LemonSqueezyResponse>()
        .await
        .map_err(|e| format!("Failed to parse validation response: {}", e))
}

/// Deactivate a license key with LemonSqueezy.
async fn api_deactivate(
    key: &str,
    instance_id: &str,
) -> Result<LemonSqueezyResponse, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/deactivate", LEMONSQUEEZY_API_BASE))
        .form(&[("license_key", key), ("instance_id", instance_id)])
        .send()
        .await
        .map_err(|e| format!("Deactivation request failed: {}", e))?;

    resp.json::<LemonSqueezyResponse>()
        .await
        .map_err(|e| format!("Failed to parse deactivation response: {}", e))
}

// ---------------------------------------------------------------------------
// Tauri command implementations
// ---------------------------------------------------------------------------

/// Activate a license key. Computes machine fingerprint, calls LemonSqueezy,
/// caches on success.
pub async fn activate(key: String) -> Result<LicenseStatus, String> {
    let fingerprint = compute_fingerprint()?;

    let resp = api_activate(&key, &fingerprint).await?;

    if resp.activated == Some(true) {
        let instance_id = resp
            .instance
            .as_ref()
            .map(|i| i.id.clone())
            .ok_or_else(|| "Activation succeeded but no instance ID returned".to_string())?;

        let activated_at = chrono::Utc::now().to_rfc3339();
        let machine_name = hostname::get()
            .ok()
            .map(|h| h.to_string_lossy().to_string());

        let cache = LicenseCache {
            key: key.clone(),
            instance_id: instance_id.clone(),
            fingerprint,
            activated_at: activated_at.clone(),
        };
        write_cache(&cache)?;

        Ok(LicenseStatus {
            activated: true,
            key: Some(key),
            instance_id: Some(instance_id),
            activated_at: Some(activated_at),
            machine_name,
            validation_error: None,
        })
    } else {
        let error = resp
            .error
            .unwrap_or_else(|| "Activation failed".to_string());
        Ok(LicenseStatus::inactive_with_error(error))
    }
}

/// Check the current license status. Reads cache, verifies fingerprint,
/// validates online if possible, trusts cache if offline.
pub async fn check() -> Result<LicenseStatus, String> {
    let cache = match read_cache()? {
        Some(c) => c,
        None => return Ok(LicenseStatus::inactive()),
    };

    // Verify fingerprint matches current machine
    let current_fingerprint = compute_fingerprint()?;
    if cache.fingerprint != current_fingerprint {
        return Ok(LicenseStatus::inactive_with_error(
            "License was activated on a different machine".to_string(),
        ));
    }

    let machine_name = hostname::get()
        .ok()
        .map(|h| h.to_string_lossy().to_string());

    // Try online validation
    match api_validate(&cache.key, &cache.instance_id).await {
        Ok(resp) => {
            if resp.valid == Some(true) {
                Ok(LicenseStatus {
                    activated: true,
                    key: Some(cache.key),
                    instance_id: Some(cache.instance_id),
                    activated_at: Some(cache.activated_at),
                    machine_name,
                    validation_error: None,
                })
            } else {
                // License is no longer valid — delete cache
                delete_cache()?;
                let error = resp
                    .error
                    .unwrap_or_else(|| "License validation failed".to_string());
                Ok(LicenseStatus::inactive_with_error(error))
            }
        }
        Err(_) => {
            // Offline — trust the cache
            Ok(LicenseStatus {
                activated: true,
                key: Some(cache.key),
                instance_id: Some(cache.instance_id),
                activated_at: Some(cache.activated_at),
                machine_name,
                validation_error: None,
            })
        }
    }
}

/// Deactivate the current license. Calls LemonSqueezy, deletes cache on success.
pub async fn deactivate() -> Result<(), String> {
    let cache = read_cache()?
        .ok_or_else(|| "No active license to deactivate".to_string())?;

    let resp = api_deactivate(&cache.key, &cache.instance_id).await?;

    if resp.deactivated == Some(true) {
        delete_cache()?;
        Ok(())
    } else {
        let error = resp
            .error
            .unwrap_or_else(|| "Deactivation failed".to_string());
        Err(error)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

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
        assert!(json["instanceId"].is_null());
    }

    #[test]
    fn test_license_status_inactive_with_error() {
        let status = LicenseStatus::inactive_with_error("Test error".to_string());
        let json = serde_json::to_value(&status).unwrap();
        assert_eq!(json["activated"], false);
        assert_eq!(json["validationError"], "Test error");
    }

    #[test]
    fn test_cache_roundtrip() {
        let temp_dir = std::env::temp_dir().join("endstate_license_test");
        let _ = fs::create_dir_all(&temp_dir);
        let cache_file = temp_dir.join("license.json");

        let cache = LicenseCache {
            key: "test-key".to_string(),
            instance_id: "test-instance".to_string(),
            fingerprint: "abc123".to_string(),
            activated_at: "2026-01-01T00:00:00Z".to_string(),
        };

        // Write
        let data = serde_json::to_string_pretty(&cache).unwrap();
        fs::write(&cache_file, &data).unwrap();

        // Read back
        let read_data = fs::read_to_string(&cache_file).unwrap();
        let read_cache: LicenseCache = serde_json::from_str(&read_data).unwrap();

        assert_eq!(read_cache.key, "test-key");
        assert_eq!(read_cache.instance_id, "test-instance");
        assert_eq!(read_cache.fingerprint, "abc123");
        assert_eq!(read_cache.activated_at, "2026-01-01T00:00:00Z");

        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_cache_serialization_camel_case() {
        let cache = LicenseCache {
            key: "k".to_string(),
            instance_id: "i".to_string(),
            fingerprint: "f".to_string(),
            activated_at: "a".to_string(),
        };
        let json = serde_json::to_value(&cache).unwrap();
        // Verify camelCase field names
        assert!(json.get("instanceId").is_some());
        assert!(json.get("activatedAt").is_some());
        assert!(json.get("instance_id").is_none());
        assert!(json.get("activated_at").is_none());
    }

    #[test]
    fn test_fingerprint_generation() {
        // This test verifies fingerprint generation works on the current Windows machine.
        // It should produce a consistent 64-char hex string.
        let fp = compute_fingerprint();
        assert!(fp.is_ok(), "Fingerprint generation should succeed on Windows");
        let fp = fp.unwrap();
        assert_eq!(fp.len(), 64, "SHA-256 hex should be 64 characters");
        assert!(
            fp.chars().all(|c| c.is_ascii_hexdigit()),
            "Fingerprint should be hex-encoded"
        );

        // Running it twice should produce the same result (deterministic)
        let fp2 = compute_fingerprint().unwrap();
        assert_eq!(fp, fp2, "Fingerprint should be deterministic");
    }
}
