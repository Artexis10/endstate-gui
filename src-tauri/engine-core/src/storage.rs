//! Local sync-folder discovery and profile I/O. No provider network requests.
use serde::Serialize;
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Mutex, OnceLock,
};

#[derive(Debug, Serialize)]
pub struct SyncLocation {
    id: String,
    provider: String,
    label: String,
    path: String,
}
#[derive(Debug, Serialize)]
pub struct ProviderDiscovery {
    provider: String,
    status: String,
    locations: Vec<SyncLocation>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}
impl ProviderDiscovery {
    fn new(provider: &str) -> Self {
        Self {
            provider: provider.into(),
            status: "not-detected".into(),
            locations: vec![],
            message: None,
        }
    }
    #[cfg(any(windows, test))]
    fn add(&mut self, label: &str, path: String) {
        if path.trim().is_empty() {
            return;
        }
        let key = |p: &str| p.replace('/', "\\").trim_end_matches('\\').to_lowercase();
        if let Some(existing) = self
            .locations
            .iter_mut()
            .find(|p| key(&p.path) == key(&path))
        {
            if existing.label == "OneDrive" && label != "OneDrive" {
                existing.label = label.into();
            }
            return;
        }
        self.locations.push(SyncLocation {
            id: format!("{}-{}", self.provider, self.locations.len()),
            provider: self.provider.clone(),
            label: label.into(),
            path,
        });
        if self.status != "error" {
            self.status = "detected".into();
        }
    }
    #[cfg(any(windows, test))]
    fn error(&mut self, reason: &str) {
        self.status = "error".into();
        self.message = Some(reason.into());
    }
}

// All host reads go through this seam so fixtures exercise the real discovery logic.
#[cfg(any(windows, test))]
trait DiscoverySource {
    fn env(&self, key: &str) -> Option<String>;
    fn registry(&self, key: &str, subkeys: bool) -> io::Result<Vec<(String, String)>>;
    fn file(&self, path: &Path) -> io::Result<String>;
}
#[cfg(any(windows, test))]
fn probe(source: &impl DiscoverySource) -> Vec<ProviderDiscovery> {
    let mut one = ProviderDiscovery::new("onedrive");
    for (key, label) in [
        ("OneDrive", "OneDrive"),
        ("OneDriveConsumer", "OneDrive personal"),
        ("OneDriveCommercial", "OneDrive business"),
    ] {
        if let Some(path) = source.env(key) {
            one.add(label, path);
        }
    }
    match source.registry("Software\\Microsoft\\OneDrive\\Accounts", true) {
        Ok(accounts) => {
            for (account, path) in accounts {
                one.add(
                    if account.eq_ignore_ascii_case("Personal") {
                        "OneDrive personal"
                    } else {
                        "OneDrive business"
                    },
                    path,
                );
            }
        }
        Err(e) if e.kind() == io::ErrorKind::NotFound => (),
        Err(_) => one.error("OneDrive account discovery failed. Choose its folder manually."),
    }
    let mut google = ProviderDiscovery::new("google-drive");
    // Drive for desktop keeps every account in one PerAccountPreferences JSON
    // value under DriveFS:
    // {"per_account_preferences":[{"key":"…","value":{"mount_point_path":"G"}}]}.
    match source.registry("Software\\Google\\DriveFS", false) {
        Ok(values) => {
            if let Some((_, payload)) = values
                .iter()
                .find(|(name, _)| name.eq_ignore_ascii_case("PerAccountPreferences"))
            {
                match serde_json::from_str::<serde_json::Value>(payload)
                    .ok()
                    .as_ref()
                    .and_then(|v| v.get("per_account_preferences"))
                    .and_then(|a| a.as_array())
                {
                    // An empty list means no signed-in account: not detected.
                    Some(accounts) => {
                        for account in accounts {
                            match account
                                .get("value")
                                .and_then(|v| v.get("mount_point_path"))
                                .and_then(|v| v.as_str())
                                .and_then(google_drive_mount)
                            {
                                Some((label, path)) => google.add(&label, path),
                                None => google.error(
                                    "Google Drive account data could not be read. Choose My Drive manually.",
                                ),
                            }
                        }
                    }
                    None => google.error(
                        "Google Drive account data could not be read. Choose My Drive manually.",
                    ),
                }
            }
        }
        Err(e) if e.kind() == io::ErrorKind::NotFound => (),
        Err(_) => google.error("Google Drive account discovery failed. Choose My Drive manually."),
    }
    let mut dropbox = ProviderDiscovery::new("dropbox");
    for key in ["LOCALAPPDATA", "APPDATA"] {
        if let Some(root) = source.env(key) {
            match source.file(&Path::new(&root).join("Dropbox").join("info.json")) {
                Ok(text) => match serde_json::from_str::<serde_json::Value>(&text) {
                    Ok(data) => {
                        for (account, label) in [
                            ("personal", "Dropbox personal"),
                            ("business", "Dropbox business"),
                        ] {
                            if let Some(entry) = data.get(account) {
                                if let Some(path) = entry
                                    .get("path")
                                    .and_then(|v| v.as_str())
                                    .filter(|p| !p.trim().is_empty())
                                {
                                    dropbox.add(label, path.into());
                                } else {
                                    dropbox.error("Dropbox account data could not be read. Choose its folder manually.");
                                }
                            }
                        }
                    }
                    Err(_) => dropbox.error(
                        "Dropbox account data could not be read. Choose its folder manually.",
                    ),
                },
                Err(e) if e.kind() == io::ErrorKind::NotFound => (),
                Err(_) => {
                    dropbox.error("Dropbox account discovery failed. Choose its folder manually.")
                }
            }
        }
    }
    vec![one, google, dropbox]
}

/// Label and My Drive path for a Drive for desktop mount, named the way
/// Explorer names it: a drive letter "G" is "Google Drive (G:)" at G:\My Drive,
/// and a mirrored folder is labelled by its folder name.
#[cfg(any(windows, test))]
fn google_drive_mount(mount: &str) -> Option<(String, String)> {
    let root = mount.trim().trim_end_matches(['\\', '/']);
    let letter = root.strip_suffix(':').unwrap_or(root);
    if letter.len() == 1 && letter.chars().all(|c| c.is_ascii_alphabetic()) {
        let letter = letter.to_ascii_uppercase();
        return Some((
            format!("Google Drive ({letter}:)"),
            format!("{letter}:\\My Drive"),
        ));
    }
    let name = root.rsplit(['\\', '/']).next().filter(|n| !n.is_empty())?;
    Some((
        format!("Google Drive ({name})"),
        format!("{root}\\My Drive"),
    ))
}

#[cfg(windows)]
struct WindowsSource;
#[cfg(windows)]
impl DiscoverySource for WindowsSource {
    fn env(&self, key: &str) -> Option<String> {
        std::env::var(key).ok()
    }
    fn file(&self, path: &Path) -> io::Result<String> {
        fs::read_to_string(path)
    }
    fn registry(&self, key: &str, subkeys: bool) -> io::Result<Vec<(String, String)>> {
        use winreg::{enums::HKEY_CURRENT_USER, RegKey};
        let key = RegKey::predef(HKEY_CURRENT_USER).open_subkey(key)?;
        let mut values = vec![];
        if subkeys {
            for account in key.enum_keys() {
                let account = account?;
                match key
                    .open_subkey(&account)
                    .and_then(|key| key.get_value::<String, _>("UserFolder"))
                {
                    Ok(path) => values.push((account, path)),
                    Err(error) if error.kind() == io::ErrorKind::NotFound => (),
                    Err(error) => return Err(error),
                }
            }
        } else {
            for value in key.enum_values() {
                let (name, _) = value?;
                // Only string values can hold account JSON. Skip DWORD or binary
                // values instead of failing the whole provider.
                if let Ok(text) = key.get_value::<String, _>(&name) {
                    values.push((name, text));
                }
            }
        }
        Ok(values)
    }
}
pub fn discover_sync_folders() -> Vec<ProviderDiscovery> {
    #[cfg(windows)]
    {
        probe(&WindowsSource)
    }
    #[cfg(not(windows))]
    {
        ["onedrive", "google-drive", "dropbox"]
            .into_iter()
            .map(|p| {
                let mut result = ProviderDiscovery::new(p);
                result.status = "unsupported".into();
                result.message = Some(
                    "Automatic discovery is available on Windows. Choose a custom folder.".into(),
                );
                result
            })
            .collect()
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileEntry {
    pub path: String,
    pub availability: String,
    pub metadata_available: bool,
}
const STAGING_PREFIX: &str = ".endstate-save-";
static NEXT_STAGE: AtomicU64 = AtomicU64::new(0);
static DEFERRED: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();
fn deferred() -> &'static Mutex<HashSet<PathBuf>> {
    DEFERRED.get_or_init(Mutex::default)
}
fn cleanup(path: &Path) {
    if let Err(e) = fs::remove_file(path) {
        if e.kind() != io::ErrorKind::NotFound {
            deferred()
                .lock()
                .unwrap_or_else(|p| p.into_inner())
                .insert(path.to_owned());
        }
    }
}
fn retry_cleanup(directory: &Path) {
    deferred()
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .retain(|path| {
            if path.parent() != Some(directory) {
                return true;
            }
            matches!(fs::remove_file(path), Err(e) if e.kind() != io::ErrorKind::NotFound)
        });
}
#[cfg(any(windows, test))]
fn online_only(attributes: u32) -> bool {
    // OFFLINE, RECALL_ON_OPEN, RECALL_ON_DATA_ACCESS (WinNT.h).
    attributes & (0x1000 | 0x40000 | 0x400000) != 0
}
fn entry_online_only(entry: &fs::DirEntry) -> io::Result<bool> {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        // DirEntry::metadata on Windows uses cached WIN32_FIND_DATA, never stat/open.
        Ok(online_only(entry.metadata()?.file_attributes()))
    }
    #[cfg(not(windows))]
    {
        let _ = entry;
        Ok(false)
    }
}
fn filename_key(name: &std::ffi::OsStr) -> String {
    let name = name.to_string_lossy().into_owned();
    if cfg!(windows) {
        name.to_lowercase()
    } else {
        name
    }
}
fn ignored(name: &str) -> bool {
    name.starts_with(STAGING_PREFIX)
        || name.starts_with(".endstate-import-")
        || name.eq_ignore_ascii_case("runs")
}
pub fn list_profile_entries(directory: &str) -> Result<Vec<ProfileEntry>, String> {
    fn visit(directory: &Path, nested: bool, out: &mut Vec<ProfileEntry>) -> io::Result<()> {
        retry_cleanup(directory);
        // Only the chosen folder itself must be readable. An entry or subfolder
        // that cannot be read is left out, so one bad entry never hides the rest.
        let entries = fs::read_dir(directory)?
            .filter_map(Result::ok)
            .collect::<Vec<_>>();
        // Sidecar lookup uses enumeration only, too. An online-only sidecar is never opened.
        let local: HashSet<_> = entries
            .iter()
            .filter_map(|e| {
                if entry_online_only(e).ok()? || !e.file_type().ok()?.is_file() {
                    None
                } else {
                    Some(filename_key(&e.file_name()))
                }
            })
            .collect();
        for entry in &entries {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if ignored(&name) {
                continue;
            }
            let (Ok(offline), Ok(kind)) = (entry_online_only(entry), entry.file_type()) else {
                continue; // Both read cached directory data on Windows.
            };
            let path = entry.path();
            if kind.is_dir() && !nested && !offline {
                let _ = visit(&path, true, out);
            } else if !kind.is_dir()
                && !kind.is_symlink()
                && path.extension().is_some_and(|e| {
                    crate::cmd::MANIFEST_EXTENSIONS
                        .contains(&e.to_string_lossy().to_lowercase().as_str())
                })
            {
                let meta = path.with_extension("meta.json");
                out.push(ProfileEntry {
                    path: path.to_string_lossy().into_owned(),
                    availability: if offline { "online-only" } else { "local" }.into(),
                    metadata_available: meta
                        .file_name()
                        .is_some_and(|n| local.contains(&filename_key(n))),
                });
            }
        }
        Ok(())
    }
    let mut entries = vec![];
    visit(Path::new(directory), false, &mut entries)
        .map_err(|e| format!("Could not list storage folder: {e}"))?;
    entries.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(entries)
}

/// The folder itself is absent while its parent is a readable directory.
/// Any other failure (no parent, access denied) is left to the listing.
fn folder_not_created_yet(directory: &Path) -> bool {
    matches!(fs::metadata(directory), Err(e) if e.kind() == io::ErrorKind::NotFound)
        && directory
            .parent()
            .filter(|p| !p.as_os_str().is_empty())
            .is_some_and(|p| fs::metadata(p).is_ok_and(|m| m.is_dir()))
}

/// The list_manifest_files command for both the app and the dev bridge: paths
/// only, or entries with availability when the caller asks for them.
pub fn list_manifest_files_value(
    directory: &str,
    include_availability: bool,
) -> Result<serde_json::Value, String> {
    if include_availability {
        // A chosen sync destination such as <OneDrive>\Endstate does not exist
        // until the first save creates it. That is an empty folder, not an
        // error; a missing parent (drive) or an access error still fails.
        let missing = folder_not_created_yet(Path::new(directory));
        let entries = if missing {
            vec![]
        } else {
            list_profile_entries(directory)?
        };
        Ok(serde_json::json!({ "entries": entries, "folderMissing": missing }))
    } else {
        serde_json::to_value(crate::cmd::list_manifest_files(directory)?).map_err(|e| e.to_string())
    }
}

fn storage_error(error: io::Error) -> String {
    if cfg!(windows) && matches!(error.raw_os_error(), Some(5 | 32 | 33)) {
        "Storage busy or inaccessible: a sync client may have locked this file. Check folder permissions and try again.".into()
    } else {
        format!("Could not save setup: {error}")
    }
}
fn stage(path: &Path, content: &[u8]) -> io::Result<PathBuf> {
    stage_with(path, |file| file.write_all(content))
}
fn stage_with(
    path: &Path,
    mut write: impl FnMut(&mut fs::File) -> io::Result<()>,
) -> io::Result<PathBuf> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "Missing parent folder"))?;
    for _ in 0..100 {
        let sequence = NEXT_STAGE.fetch_add(1, Ordering::Relaxed);
        let temp = parent.join(format!(
            "{STAGING_PREFIX}{}-{sequence}.tmp",
            std::process::id()
        ));
        let mut file = match OpenOptions::new().write(true).create_new(true).open(&temp) {
            Ok(file) => file,
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(e),
        };
        let result = write(&mut file).and_then(|_| file.sync_all());
        drop(file);
        if let Err(e) = result {
            cleanup(&temp);
            return Err(e);
        }
        return Ok(temp);
    }
    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "Could not allocate staging file",
    ))
}
fn commit(stage: &Path, destination: &Path, create_new: bool) -> io::Result<()> {
    if create_new {
        // On Windows this is a native MoveFileEx without REPLACE_EXISTING. On
        // Unix tempfile uses no-clobber rename or link. No empty final reservation.
        tempfile::TempPath::try_from_path(stage)?
            .persist_noclobber(destination)
            .map_err(|error| error.error)?;
        cleanup(stage); // Unix link fallback can leave the original staging name.
        Ok(())
    } else {
        // Rust uses native atomic replacement on the same filesystem.
        fs::rename(stage, destination)
    }
}

/// Captured bundles can be large, so stream them to a staged sibling before commit.
pub fn copy_profile(source: &str, destination: &str) -> Result<(), String> {
    let destination = Path::new(destination);
    if destination.to_string_lossy().contains('\0') {
        return Err("Invalid destination path".into());
    }
    if let Some(parent) = destination.parent() {
        retry_cleanup(parent);
    }
    let mut source = fs::File::open(source).map_err(storage_error)?;
    let staged = stage_with(destination, |file| io::copy(&mut source, file).map(|_| ()))
        .map_err(storage_error)?;
    drop(source);
    if let Err(error) = commit(&staged, destination, false) {
        cleanup(&staged);
        return Err(storage_error(error));
    }
    Ok(())
}

/// One native operation owns staging, flushing, optional sidecar, and final rename.
/// Metadata is committed first for new profiles; the manifest is the visibility marker.
pub fn save_profile(
    path: &str,
    content: &str,
    metadata: Option<&str>,
    create_new: bool,
) -> Result<(), String> {
    let path = Path::new(path);
    if path.as_os_str().is_empty()
        || path.file_name().is_none()
        || path.to_string_lossy().contains('\0')
    {
        return Err("Choose a valid setup file path".into());
    }
    if metadata.is_some() && !create_new {
        return Err("Metadata can only accompany a new setup".into());
    }
    if let Some(parent) = path.parent() {
        retry_cleanup(parent);
    }
    let payload = stage(path, content.as_bytes()).map_err(storage_error)?;
    let meta_path = path.with_extension("meta.json");
    let mut committed_meta = false;
    let operation = (|| -> io::Result<()> {
        if let Some(metadata) = metadata {
            let staged_meta = stage(&meta_path, metadata.as_bytes())?;
            if let Err(e) = commit(&staged_meta, &meta_path, true) {
                cleanup(&staged_meta);
                return Err(e);
            }
            committed_meta = true;
        }
        commit(&payload, path, create_new)
    })();
    if let Err(e) = operation {
        cleanup(&payload);
        // Remove the sidecar this call committed, now and only now. It is a real
        // file, not a staging name, so it must never join the deferred cleanup
        // set: a later retry would delete a sidecar that a later save wrote.
        if committed_meta {
            let _ = fs::remove_file(&meta_path);
        }
        return Err(storage_error(e));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    #[derive(Default)]
    struct Fixture {
        env: HashMap<String, String>,
        registry: HashMap<String, Vec<(String, String)>>,
        files: HashMap<PathBuf, String>,
    }
    impl DiscoverySource for Fixture {
        fn env(&self, key: &str) -> Option<String> {
            self.env.get(key).cloned()
        }
        fn registry(&self, key: &str, _: bool) -> io::Result<Vec<(String, String)>> {
            Ok(self.registry.get(key).cloned().unwrap_or_default())
        }
        fn file(&self, path: &Path) -> io::Result<String> {
            self.files
                .get(path)
                .cloned()
                .ok_or(io::ErrorKind::NotFound.into())
        }
    }
    #[test]
    fn discovery_isolates_provider_errors_and_keeps_all_accounts() {
        let mut f = Fixture::default();
        f.env.insert("OneDrive".into(), "C:\\Personal".into());
        f.env
            .insert("OneDriveConsumer".into(), "c:/personal/".into());
        f.registry.insert(
            "Software\\Microsoft\\OneDrive\\Accounts".into(),
            vec![
                ("Business1".into(), "C:\\Work1".into()),
                ("Business2".into(), "C:\\Work2".into()),
            ],
        );
        f.registry.insert(
            "Software\\Google\\DriveFS".into(),
            vec![(
                "PerAccountPreferences".into(),
                r#"{"per_account_preferences":[{"key":"secret","value":{}},{"key":"ok","value":{"mount_point_path":"G:"}}]}"#.into(),
            )],
        );
        for (key, root) in [("LOCALAPPDATA", "local"), ("APPDATA", "roaming")] {
            f.env.insert(key.into(), root.into());
            f.files.insert(
                Path::new(root).join("Dropbox/info.json"),
                r#"{"personal":{"path":"C:\\Dropbox"},"business":{"path":"D:\\Dropbox"}}"#.into(),
            );
        }
        let results = probe(&f);
        assert_eq!(results[0].locations.len(), 3);
        assert_eq!(results[1].status, "error");
        assert_eq!(results[1].locations[0].path, "G:\\My Drive");
        assert!(!results[1].message.as_ref().unwrap().contains("secret"));
        assert_eq!(results[2].locations.len(), 2);
    }
    #[test]
    fn google_drive_reads_the_combined_drivefs_value_and_drive_letters() {
        let mut f = Fixture::default();
        f.registry.insert(
            "Software\\Google\\DriveFS".into(),
            vec![
                ("Version".into(), "100".into()),
                (
                    "PerAccountPreferences".into(),
                    r#"{"per_account_preferences":[{"key":"1","value":{"mount_point_path":"G"}},{"key":"2","value":{"mount_point_path":"H:\\"}}]}"#.into(),
                ),
            ],
        );
        let google = &probe(&f)[1];
        assert_eq!(google.status, "detected");
        let found: Vec<_> = google
            .locations
            .iter()
            .map(|l| (l.label.as_str(), l.path.as_str()))
            .collect();
        assert_eq!(
            found,
            [
                ("Google Drive (G:)", "G:\\My Drive"),
                ("Google Drive (H:)", "H:\\My Drive")
            ]
        );
    }
    #[test]
    fn google_drive_labels_a_mirrored_folder_by_its_name() {
        assert_eq!(
            google_drive_mount("D:\\Sync\\Work Drive\\"),
            Some((
                "Google Drive (Work Drive)".into(),
                "D:\\Sync\\Work Drive\\My Drive".into()
            ))
        );
        assert_eq!(google_drive_mount("  "), None);
    }
    #[test]
    fn google_drive_with_no_signed_in_account_is_not_an_error() {
        let mut f = Fixture::default();
        f.registry.insert(
            "Software\\Google\\DriveFS".into(),
            vec![(
                "PerAccountPreferences".into(),
                r#"{"per_account_preferences":[]}"#.into(),
            )],
        );
        let google = &probe(&f)[1];
        assert_eq!(google.status, "not-detected");
        assert!(google.message.is_none());
    }
    #[test]
    fn all_recall_attributes_are_online_only() {
        for mask in [0x1000, 0x40000, 0x400000, 0x400020] {
            assert!(online_only(mask));
        }
        assert!(!online_only(0x20));
    }
    fn test_dir() -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "endstate-storage-test-{}-{}",
            std::process::id(),
            NEXT_STAGE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&path).unwrap();
        path
    }
    #[test]
    fn save_commits_complete_profile_and_sidecar_without_clobbering() {
        let dir = test_dir();
        let path = dir.join("setup.jsonc");
        let p = path.to_str().unwrap();
        save_profile(p, "complete", Some(r#"{"displayName":"Test"}"#), true).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "complete");
        assert!(save_profile(p, "partial", None, true).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "complete");
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 2);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn failed_payload_commit_rolls_back_new_metadata_and_staging() {
        let dir = test_dir();
        let path = dir.join("existing.jsonc");
        fs::write(&path, "original").unwrap();
        assert!(save_profile(
            path.to_str().unwrap(),
            "replacement",
            Some("metadata"),
            true
        )
        .is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "original");
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 1);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn listing_excludes_staging_and_retains_conflict_copies() {
        let dir = test_dir();
        for name in [
            "setup.jsonc",
            "setup (conflicted copy).jsonc",
            ".endstate-save-1.jsonc",
        ] {
            fs::write(dir.join(name), "data").unwrap();
        }
        let entries = list_profile_entries(dir.to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 2);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn a_destination_not_created_yet_lists_empty_but_a_missing_parent_fails() {
        let dir = test_dir();
        let pending = dir.join("Endstate");
        let value = list_manifest_files_value(pending.to_str().unwrap(), true).unwrap();
        assert_eq!(value["folderMissing"], true);
        assert_eq!(value["entries"].as_array().unwrap().len(), 0);
        let orphan = dir.join("missing-parent").join("Endstate");
        assert!(list_manifest_files_value(orphan.to_str().unwrap(), true).is_err());
        fs::create_dir(&pending).unwrap();
        fs::write(pending.join("setup.jsonc"), "data").unwrap();
        let value = list_manifest_files_value(pending.to_str().unwrap(), true).unwrap();
        assert_eq!(value["folderMissing"], false);
        assert_eq!(value["entries"].as_array().unwrap().len(), 1);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn listing_skips_runs_in_any_case() {
        let dir = test_dir();
        fs::create_dir(dir.join("Runs")).unwrap();
        fs::write(dir.join("Runs").join("summary.json"), "{}").unwrap();
        fs::write(dir.join("setup.jsonc"), "data").unwrap();
        let entries = list_profile_entries(dir.to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 1);
        fs::remove_dir_all(dir).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn unreadable_subfolder_does_not_hide_other_profiles() {
        use std::os::unix::fs::PermissionsExt;
        let dir = test_dir();
        let locked = dir.join("locked");
        fs::create_dir(&locked).unwrap();
        fs::write(dir.join("setup.jsonc"), "data").unwrap();
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();
        let entries = list_profile_entries(dir.to_str().unwrap());
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
        assert_eq!(entries.unwrap().len(), 1);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn copy_commits_complete_binary_and_missing_source_preserves_destination() {
        let dir = test_dir();
        let source = dir.join("capture.endstate");
        let destination = dir.join("saved.endstate");
        let bytes = [0, 255, 1, 2, 3];
        fs::write(&source, bytes).unwrap();
        copy_profile(source.to_str().unwrap(), destination.to_str().unwrap()).unwrap();
        assert_eq!(fs::read(&destination).unwrap(), bytes);
        assert!(copy_profile(
            dir.join("missing").to_str().unwrap(),
            destination.to_str().unwrap()
        )
        .is_err());
        assert_eq!(fs::read(&destination).unwrap(), bytes);
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 2);
        fs::remove_dir_all(dir).unwrap();
    }
    #[test]
    fn existing_sidecar_is_never_overwritten_by_a_new_profile_transaction() {
        let dir = test_dir();
        let path = dir.join("setup.jsonc");
        let sidecar = path.with_extension("meta.json");
        fs::write(&sidecar, "previous metadata").unwrap();
        assert!(save_profile(
            path.to_str().unwrap(),
            "new setup",
            Some("new metadata"),
            true
        )
        .is_err());
        assert!(!path.exists());
        assert_eq!(fs::read_to_string(&sidecar).unwrap(), "previous metadata");
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 1);
        fs::remove_dir_all(dir).unwrap();
    }
    #[cfg(windows)]
    #[test]
    fn enumeration_reports_offline_attributes_without_reading_content() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = test_dir();
        let path = dir.join("online.jsonc");
        // Create a test-only file with FILE_ATTRIBUTE_OFFLINE, without a provider.
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .attributes(0x1000)
            .open(&path)
            .unwrap();
        file.write_all(b"not a valid manifest").unwrap();
        drop(file);
        let entries = list_profile_entries(dir.to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].availability, "online-only");
        fs::remove_dir_all(dir).unwrap();
    }
    #[cfg(windows)]
    #[test]
    fn locked_destination_and_staging_preserve_previous_file() {
        use std::os::windows::fs::OpenOptionsExt;
        let dir = test_dir();
        let path = dir.join("setup.jsonc");
        fs::write(&path, "original").unwrap();
        let lock = OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&path)
            .unwrap();
        assert!(save_profile(path.to_str().unwrap(), "new", None, false)
            .unwrap_err()
            .contains("Storage busy"));
        drop(lock);
        assert_eq!(fs::read_to_string(&path).unwrap(), "original");
        let staged = stage(&path, b"new").unwrap();
        let lock = OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&staged)
            .unwrap();
        assert!(commit(&staged, &path, false).is_err());
        cleanup(&staged);
        assert!(list_profile_entries(dir.to_str().unwrap())
            .unwrap()
            .iter()
            .all(|e| !e.path.contains(STAGING_PREFIX)));
        drop(lock);
        retry_cleanup(&dir);
        assert!(!staged.exists());
        assert_eq!(fs::read_to_string(&path).unwrap(), "original");
        fs::remove_dir_all(dir).unwrap();
    }
}
