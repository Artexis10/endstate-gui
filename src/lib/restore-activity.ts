/**
 * Restore & artifact activity-row mapping.
 *
 * The engine streams config-restore progress as `restore-item` events whose
 * `id`/`source`/`target` carry raw copy-spec text (e.g.
 * `./configs/notepad-plus-plus/contextMenu.xml -> %APPDATA%/Notepad++/…`). That
 * jargon must never reach the activity feed (hard project rule: never surface
 * raw engine strings). This module maps a `restore-item` event to a friendly,
 * envelope-named `AppEvent` row and derives a STABLE identity so the
 * transitional (`restoring`) and terminal (`restored`/`skipped`/`failed`) events
 * reconcile into ONE row rather than appending duplicates.
 *
 * See docs/ux-language.md ("Config restore rows") and the engine
 * event-contract.md "Restore-Item Event" section.
 */

import type { AppEvent, RestoreStatusKey, StatusKey } from './apply-utils';
import { getRestoreUiStatus } from './apply-utils';
import type { ArtifactEvent, RestoreItemEvent } from './streaming-events';
import type { RestoreModuleRef } from '../types';

/**
 * Resolution context sourced from the preview/apply envelope. Both fields are
 * optional: with neither, rows still resolve to `<module-id> · <basename>` from
 * the restore item's own source path — never the raw copy-spec.
 */
export interface RestoreRowContext {
  /** Winget id → qualified module id (e.g. `apps.vscode`). Engine-provided. */
  configModuleMap?: Record<string, string>;
  /** Enriched module refs carrying engine display names. */
  restoreModulesAvailable?: RestoreModuleRef[];
}

/** Strip the engine's `apps.` module-id qualifier for cross-source matching. */
function unqualifyModuleId(moduleId: string): string {
  return moduleId.startsWith('apps.') ? moduleId.slice('apps.'.length) : moduleId;
}

/**
 * Last path segment of a target/source, tolerant of `/`, `\` and `%VAR%`
 * prefixes. Returns the input unchanged when it has no separators.
 */
export function restoreTargetBasename(pathLike: string): string {
  if (!pathLike) return '';
  const segments = pathLike.split(/[\\/]/).filter((s) => s.length > 0);
  return segments.length > 0 ? segments[segments.length - 1] : pathLike;
}

/**
 * Derive the config module id for a restore item, mirroring the engine's own
 * path-derivation tier order:
 *   1. the explicit `module` field,
 *   2. the `./configs/<module-id>/…` source-path segment,
 *   3. the owning `configSetId` (excluding the anonymous `legacy` lane).
 */
export function deriveRestoreModuleId(event: RestoreItemEvent): string | undefined {
  if (event.module && event.module.trim()) {
    return unqualifyModuleId(event.module.trim());
  }
  const fromSource = event.source?.match(/(?:^|[\\/])configs[\\/]([^\\/]+)[\\/]/i);
  if (fromSource) {
    return unqualifyModuleId(fromSource[1]);
  }
  if (event.configSetId && event.configSetId.trim() && event.configSetId !== 'legacy') {
    return unqualifyModuleId(event.configSetId.trim());
  }
  return undefined;
}

/** Resolve an engine-provided display name for a module id, if available. */
export function resolveRestoreModuleDisplayName(
  moduleId: string,
  context: RestoreRowContext,
): string | undefined {
  const target = unqualifyModuleId(moduleId);
  const match = context.restoreModulesAvailable?.find(
    (m) => unqualifyModuleId(m.id) === target,
  );
  return match?.displayName;
}

/**
 * The primary row label: `<display name or module id> · <file basename>`.
 * Never returns the raw copy-spec.
 */
export function restoreRowPrimary(event: RestoreItemEvent, context: RestoreRowContext): string {
  const basename = restoreTargetBasename(event.target || event.source || event.id);
  const moduleId = deriveRestoreModuleId(event);
  const label = moduleId ? resolveRestoreModuleDisplayName(moduleId, context) ?? moduleId : undefined;
  return label ? `${label} · ${basename}` : basename;
}

/**
 * Guard against leaking raw engine path/copy-spec text into row copy. Prose
 * like "restored successfully" passes; anything path-shaped does not.
 */
function isCleanRestoreText(text: string): boolean {
  return !/\/copy:|->|\\|%|[A-Za-z]:[\\/]/.test(text);
}

/**
 * Friendly, jargon-free secondary line. Terminal skip/failure reasons become
 * plain-language copy; the engine-authored message is preferred when present
 * and clean. See docs/ux-language.md for the canonical strings.
 */
export function restoreRowSecondary(event: RestoreItemEvent): string | undefined {
  const message = event.message?.trim();
  const cleanMessage = message && isCleanRestoreText(message) ? message : undefined;

  switch (event.status) {
    case 'restoring':
    case 'restored':
      return undefined;
    case 'skipped_up_to_date':
      return cleanMessage ?? 'Already matches your saved settings';
    case 'skipped_missing_source':
      return cleanMessage ?? "The saved copy wasn't found, so nothing changed";
    case 'failed':
      return cleanMessage ?? "Couldn't restore this file";
    default:
      return cleanMessage;
  }
}

/** Full raw source→target detail, for a hover title / disclosure only. */
export function restoreRowTitle(event: RestoreItemEvent): string {
  return `${event.source} → ${event.target}`;
}

/**
 * Stable reconciliation identity for a restore item, constant across its
 * `restoring` → terminal lifecycle. Keeps the ⚙ prefix so existing
 * settings-row detection (`app.startsWith('⚙')`) still recognises it.
 */
export function restoreRowKey(event: RestoreItemEvent): string {
  return `⚙ restore:${event.target || event.id}`;
}

/** Map an engine restore status to the generic StatusKey used for counters. */
export function restoreStatusToStatusKey(status: RestoreStatusKey): StatusKey {
  switch (status) {
    case 'restored':
      return 'installed';
    case 'restoring':
      return 'installing';
    case 'failed':
      return 'failed';
    case 'skipped_up_to_date':
    case 'skipped_missing_source':
    default:
      return 'skipped';
  }
}

/** Map a `restore-item` event to a friendly, reconcilable activity row. */
export function restoreEventToAppEvent(
  event: RestoreItemEvent,
  context: RestoreRowContext,
): AppEvent {
  return {
    app: restoreRowKey(event),
    kind: 'restore',
    restoreStatus: event.status,
    name: restoreRowPrimary(event, context),
    secondary: restoreRowSecondary(event),
    title: restoreRowTitle(event),
    action: getRestoreUiStatus(event.status).shortLabel,
    statusKey: restoreStatusToStatusKey(event.status),
    phase: 'apply',
    timestamp: Date.now(),
    reason: event.reason ?? null,
  };
}

/**
 * Map a produced-artifact event (e.g. the captured profile bundle) to a distinct
 * muted completion line, NOT an app-style "DETECTED" status row.
 */
export function artifactEventToAppEvent(event: ArtifactEvent): AppEvent {
  return {
    app: `artifact:${event.path}`,
    kind: 'artifact',
    name: 'Saved profile bundle',
    secondary: restoreTargetBasename(event.path),
    title: event.path,
    action: 'Saved',
    statusKey: 'installed',
    phase: 'capture',
    timestamp: Date.now(),
  };
}
