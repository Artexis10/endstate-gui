import { describe, it, expect } from 'vitest';
import {
  restoreEventToAppEvent,
  deriveRestoreModuleId,
  restoreTargetBasename,
  artifactEventToAppEvent,
} from './restore-activity';
import type { RestoreItemEvent, ArtifactEvent } from './streaming-events';

/**
 * Fails-first coverage for the exact screenshot defect: a legacy config-restore
 * item streamed as a raw `/copy:<source>-><target>` spec, duplicated across the
 * `restoring` -> terminal status transition, and mislabelled "INSTALLING".
 */

const base = {
  event: 'restore-item' as const,
  version: 1,
  runId: 'apply-e2e',
  timestamp: '2025-01-01T00:00:00.000Z',
  restorer: 'copy',
  reason: null,
  backupPath: null,
  targetExisted: true,
};

// Legacy lane: module is empty and the id is the raw copy-spec, exactly as the
// real engine emitted in the user's screenshot.
const legacyRestoring: RestoreItemEvent = {
  ...base,
  id: 'copy:./configs/notepad-plus-plus/contextMenu.xml->%APPDATA%/Notepad++/contextMenu.xml',
  module: '',
  source: './configs/notepad-plus-plus/contextMenu.xml',
  target: '%APPDATA%/Notepad++/contextMenu.xml',
  status: 'restoring',
  message: '',
};

const legacyRestored: RestoreItemEvent = {
  ...legacyRestoring,
  status: 'restored',
  message: 'restored successfully',
};

const ctx = {
  restoreModulesAvailable: [{ id: 'notepad-plus-plus', displayName: 'Notepad++' }],
};

describe('restore-activity row mapping', () => {
  it('renders the engine display name + file basename, never the raw copy-spec', () => {
    const row = restoreEventToAppEvent(legacyRestoring, ctx);
    expect(row.name).toBe('Notepad++ · contextMenu.xml');
    // No raw copy jargon anywhere the user reads (name / secondary).
    expect(row.name).not.toContain('/copy:');
    expect(row.name).not.toContain('->');
    expect(row.secondary ?? '').not.toContain('/copy:');
  });

  it('uses RESTORING / RESTORED verbs, not INSTALLING', () => {
    expect(restoreEventToAppEvent(legacyRestoring, ctx).restoreStatus).toBe('restoring');
    expect(restoreEventToAppEvent(legacyRestored, ctx).restoreStatus).toBe('restored');
  });

  it('falls back to <module-id> · <basename> when no display name resolves', () => {
    const row = restoreEventToAppEvent(legacyRestoring, {});
    expect(row.name).toBe('notepad-plus-plus · contextMenu.xml');
    expect(row.name).not.toContain('/copy:');
  });

  it('derives the module id from the source path when module is empty', () => {
    expect(deriveRestoreModuleId(legacyRestoring)).toBe('notepad-plus-plus');
  });

  it('resolves the display name tolerant of an apps. prefix on the module field', () => {
    const ev: RestoreItemEvent = {
      ...base,
      id: 'vscode/settings.json',
      module: 'apps.vscode',
      source: './configs/vscode/settings.json',
      target: 'C:/Users/me/AppData/Roaming/Code/User/settings.json',
      status: 'restored',
      message: 'restored successfully',
    };
    const row = restoreEventToAppEvent(ev, {
      restoreModulesAvailable: [{ id: 'vscode', displayName: 'Visual Studio Code' }],
    });
    expect(row.name).toBe('Visual Studio Code · settings.json');
  });

  it('keeps a stable identity across the lifecycle so rows reconcile in place', () => {
    expect(restoreEventToAppEvent(legacyRestoring, ctx).app).toBe(
      restoreEventToAppEvent(legacyRestored, ctx).app,
    );
  });

  it('carries the raw source→target detail only in the hover title', () => {
    const row = restoreEventToAppEvent(legacyRestored, ctx);
    expect(row.title).toContain('./configs/notepad-plus-plus/contextMenu.xml');
    expect(row.title).toContain('%APPDATA%/Notepad++/contextMenu.xml');
    // The title is a disclosure/tooltip affordance, never the inline row text.
    expect(row.name).not.toContain(row.title ?? '@@');
  });

  it('surfaces a friendly, jargon-free secondary line for skips', () => {
    const skip: RestoreItemEvent = { ...legacyRestored, status: 'skipped_up_to_date', message: '' };
    const row = restoreEventToAppEvent(skip, ctx);
    expect(row.secondary).toBeTruthy();
    expect(row.secondary!).not.toContain('/copy:');
    expect(row.secondary!).not.toContain('->');
  });

  it('extracts the basename from Windows-style and %VAR% targets', () => {
    expect(restoreTargetBasename('%APPDATA%/Notepad++/contextMenu.xml')).toBe('contextMenu.xml');
    expect(restoreTargetBasename('C:\\Users\\me\\AppData\\Roaming\\Code\\User\\settings.json')).toBe('settings.json');
  });
});

describe('artifact row mapping', () => {
  const artifact: ArtifactEvent = {
    event: 'artifact',
    version: 1,
    runId: 'capture-e2e',
    timestamp: '2025-01-01T00:00:00.000Z',
    phase: 'capture',
    kind: 'manifest',
    path: 'C:\\Users\\me\\profiles\\captured.jsonc',
  };

  it('renders a distinct completion line, not an app-style DETECTED row', () => {
    const row = artifactEventToAppEvent(artifact);
    expect(row.kind).toBe('artifact');
    expect(row.name).toBe('Saved profile bundle');
    expect(row.secondary).toBe('captured.jsonc');
    // The old bug rendered this as a DETECTED app row.
    expect(row.statusKey).not.toBe('detected');
    expect(row.title).toContain('captured.jsonc');
  });
});
