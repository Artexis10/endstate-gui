/**
 * Stable key for associating a local profile with its hosted-backup id.
 *
 * The key is the durable handle stored in `AppSettings.profileBackupIds`
 * (profileKey → backupId). Backups are addressed by their backend-assigned
 * **id**; this key is only the *local* lookup handle for that id.
 *
 * We use the profile's absolute **path** because it is unique per profile on
 * disk: two profiles that happen to share a display name still live at
 * different paths, so they map to different backups (the per-profile cloud
 * badge must not cross-contaminate on name collisions). The trade-off is that
 * moving/renaming a profile file orphans its mapping (it re-hosts as a new
 * backup) — acceptable for now; a stable manifest-embedded profile id that
 * survives moves is deferred.
 */
export function profileKeyFor(profile: { path: string }): string {
  return profile.path;
}
