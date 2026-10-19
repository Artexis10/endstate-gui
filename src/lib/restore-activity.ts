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
import { getRestoreUiStatus, RESTORE_OUTCOME_ORDER } from './apply-utils';
import type { ArtifactEvent, RestoreItemEvent } from './streaming-events';
import type { RestoreModuleRef, RestoreResultStatus } from '../types';
import { appModuleKey, settingsKind } from './settings-kind';

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
    return appModuleKey(event.module.trim());
  }
  const fromSource = event.source?.match(/(?:^|[\\/])configs[\\/]([^\\/]+)[\\/]/i);
  if (fromSource) {
    return appModuleKey(fromSource[1]);
  }
  if (event.configSetId && event.configSetId.trim() && event.configSetId !== 'legacy') {
    return appModuleKey(event.configSetId.trim());
  }
  return undefined;
}

/** Resolve an engine-provided display name for a module id, if available. */
export function resolveRestoreModuleDisplayName(
  moduleId: string,
  context: RestoreRowContext,
): string | undefined {
  const target = appModuleKey(moduleId);
  const match = context.restoreModulesAvailable?.find(
    (m) => appModuleKey(m.id) === target,
  );
  return match?.displayName;
}

/**
 * `registry-set` and `registry-import` (engine restore types, protocol tokens)
 * write registry values. Their targets and engine messages name registry
 * internals, which the default UI never shows (docs/ux-guardrails.md, "Jargon
 * in Default UX").
 */
function isRegistryRestore(event: RestoreItemEvent): boolean {
  return event.restorer === 'registry-set' || event.restorer === 'registry-import';
}

/**
 * What tells one restore item of a module from another: the engine's label
 * when it sends one, otherwise the target file name. A registry key or value
 * name is never shown inline; the hover title keeps it.
 */
function restoreRowDisambiguator(event: RestoreItemEvent): string | undefined {
  const label = event.label?.trim();
  if (label) return label;
  if (isRegistryRestore(event)) return undefined;
  return restoreTargetBasename(event.target || event.source || event.id);
}

/**
 * The primary row label: `<display name or module id> · <label or file
 * basename>`. Never returns the raw copy-spec or a registry key or value name.
 */
export function restoreRowPrimary(event: RestoreItemEvent, context: RestoreRowContext): string {
  const moduleId = deriveRestoreModuleId(event);
  const moduleName = moduleId ? resolveRestoreModuleDisplayName(moduleId, context) ?? moduleId : undefined;
  const parts = [moduleName, restoreRowDisambiguator(event)].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(' · ') : 'Setting';
}

/**
 * Guard against leaking raw engine path/copy-spec text into row copy. Prose
 * like "restored successfully" passes; anything path-shaped does not.
 */
function isCleanRestoreText(text: string): boolean {
  return !/\/copy:|->|\\|%|[A-Za-z]:[\\/]/.test(text);
}

/**
 * Friendly, jargon-free secondary line: a failure's reason, and nothing else.
 * Every other status label already says what happened ("UP TO DATE", "NOT IN
 * SETUP"), so a restatement only adds noise. The engine-authored message is
 * preferred when present and clean. A preview restores nothing, so its
 * canonical failure says the check failed. See docs/ux-language.md.
 */
function restoreRowSecondary(event: RestoreItemEvent, preview = false): string | undefined {
  if (event.status !== 'failed') return undefined;
  const message = event.message?.trim();
  // A registry restore's engine message names registry internals, so its row
  // uses the canonical string and the hover title keeps the message.
  const cleanMessage = message && !isRegistryRestore(event) && isCleanRestoreText(message) ? message : undefined;
  return cleanMessage ?? `Couldn't ${preview ? 'check' : 'restore'} this ${isRegistryRestore(event) ? 'setting' : 'file'}`;
}

/** Full raw source→target detail, for a hover title / disclosure only. */
export function restoreRowTitle(event: RestoreItemEvent): string {
  // A restore type with no source file (such as `registry-set`) has only a target.
  const detail = event.source ? `${event.source} → ${event.target}` : event.target;
  const message = event.message?.trim();
  return isRegistryRestore(event) && message ? `${detail}\n${message}` : detail;
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

/**
 * Map a `restore-item` event to a friendly, reconcilable activity row.
 * `preview` is the run's dry-run flag: a preview row never reads RESTORED.
 */
export function restoreEventToAppEvent(
  event: RestoreItemEvent,
  context: RestoreRowContext,
  options: { preview?: boolean } = {},
): AppEvent {
  const preview = options.preview === true;
  const moduleId = deriveRestoreModuleId(event);
  const name = restoreRowPrimary(event, context);
  const secondary = restoreRowSecondary(event, preview);
  return {
    app: restoreRowKey(event),
    kind: 'restore',
    restoreStatus: event.status,
    settingsKind: moduleId ? settingsKind(moduleId) : 'app',
    preview,
    name,
    label: event.label?.trim() || undefined,
    secondary,
    // A long row truncates, so the hover title starts with its full text.
    title: `${[name, secondary].filter(Boolean).join(' · ')}\n${restoreRowTitle(event)}`,
    action: getRestoreUiStatus(event.status, { preview }).shortLabel,
    statusKey: restoreStatusToStatusKey(event.status),
    phase: 'apply',
    timestamp: Date.now(),
    reason: event.reason ?? null,
  };
}

/**
 * Count settings-restore outcomes from the activity rows. Rows reconcile to
 * one per restore target, so these counts always equal the rows shown. This is
 * the only restore counting source: the apply envelope carries no restore
 * summary. An in-progress (`restoring`) row is not an outcome.
 */
export function countRestoreOutcomes(
  events: readonly AppEvent[],
): Record<RestoreResultStatus, number> {
  const counts = Object.fromEntries(
    RESTORE_OUTCOME_ORDER.map((status) => [status, 0]),
  ) as Record<RestoreResultStatus, number>;
  for (const event of events) {
    const status = event.kind === 'restore' ? event.restoreStatus : undefined;
    if (status && status !== 'restoring') counts[status] += 1;
  }
  return counts;
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
