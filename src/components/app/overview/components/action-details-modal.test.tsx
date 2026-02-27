import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionDetailsModal } from './action-details-modal';
import type { ActionResult } from '../types';
import type { CaptureConfigModule } from '@/types';

function makeResult(overrides: Partial<ActionResult> = {}): ActionResult {
  return {
    action: 'capture',
    status: 'success',
    summary: '3 apps captured',
    outputFormat: 'zip',
    appEvents: [
      { app: 'Microsoft.VisualStudioCode', action: 'Captured', statusKey: 'detected', phase: 'capture' as never },
      { app: 'Obsidian.Obsidian', action: 'Captured', statusKey: 'detected', phase: 'capture' as never },
    ],
    counts: { total: 2, configsCaptured: 1 },
    ...overrides,
  };
}

const noop = () => {};

describe('ActionDetailsModal config matching', () => {
  describe('configModules path (engine-provided appId)', () => {
    it('matches config module to app via wingetRefs', () => {
      const configModules: CaptureConfigModule[] = [
        { id: 'apps.vscode', appId: 'vscode', displayName: 'Visual Studio Code', status: 'captured', filesCaptured: 5, wingetRefs: ['Microsoft.VisualStudioCode'] },
      ];
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({ configModules })}
          actionProgress={null}
        />
      );

      // The VS Code app row should have a "Settings" badge
      const badges = screen.getAllByTestId('config-captured');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('filters out skipped modules', () => {
      const configModules: CaptureConfigModule[] = [
        { id: 'apps.vscode', appId: 'vscode', displayName: 'Visual Studio Code', status: 'captured', filesCaptured: 5 },
        { id: 'apps.notepad', appId: 'notepad', displayName: 'Notepad', status: 'skipped', filesCaptured: 0 },
      ];
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({ configModules })}
          actionProgress={null}
        />
      );

      // Only captured module should appear as badge, not skipped
      const capturedBadges = screen.queryAllByTestId('config-captured');
      expect(capturedBadges).toHaveLength(1);
    });

    it('shows unmatched modules with displayName', () => {
      const configModules: CaptureConfigModule[] = [
        { id: 'apps.unknown-tool', appId: 'unknown-tool', displayName: 'Unknown Tool Settings', status: 'captured', filesCaptured: 3 },
      ];
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({ configModules })}
          actionProgress={null}
        />
      );

      // Unmatched module should appear as standalone row with displayName
      expect(screen.getByText('Unknown Tool Settings')).toBeInTheDocument();
    });

    it('shows error modules with error badge', () => {
      const configModules: CaptureConfigModule[] = [
        { id: 'apps.vscode', appId: 'vscode', displayName: 'Visual Studio Code', status: 'error', filesCaptured: 0 },
      ];
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({ configModules })}
          actionProgress={null}
        />
      );

      const errorBadges = screen.getAllByTestId('config-errored');
      expect(errorBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('wingetRefs exact matching', () => {
    it('matches config module to app via wingetRefs exact match', () => {
      const configModules: CaptureConfigModule[] = [
        { id: 'apps.vscode', appId: 'vscode', displayName: 'Visual Studio Code', status: 'captured', filesCaptured: 5, wingetRefs: ['Microsoft.VisualStudioCode'] },
      ];
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({ configModules })}
          actionProgress={null}
        />
      );

      const badges = screen.getAllByTestId('config-captured');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('matches wingetRefs case-insensitively', () => {
      const configModules: CaptureConfigModule[] = [
        { id: 'apps.vscode', appId: 'vscode', displayName: 'Visual Studio Code', status: 'captured', filesCaptured: 5, wingetRefs: ['microsoft.visualstudiocode'] },
      ];
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({ configModules })}
          actionProgress={null}
        />
      );

      // Case-insensitive: "microsoft.visualstudiocode" matches "Microsoft.VisualStudioCode"
      const badges = screen.getAllByTestId('config-captured');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('shows unmatched when wingetRefs has no match', () => {
      const configModules: CaptureConfigModule[] = [
        { id: 'apps.vscode', appId: 'vscode', displayName: 'Visual Studio Code', status: 'captured', filesCaptured: 5, wingetRefs: ['Some.Other.Id'] },
      ];
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({ configModules })}
          actionProgress={null}
        />
      );

      // No wingetRefs match — shows as unmatched standalone row
      expect(screen.getByText('Visual Studio Code')).toBeInTheDocument();
    });

    it('shows unmatched when wingetRefs is empty array', () => {
      const configModules: CaptureConfigModule[] = [
        { id: 'apps.vscode', appId: 'vscode', displayName: 'Visual Studio Code', status: 'captured', filesCaptured: 5, wingetRefs: [] },
      ];
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({ configModules })}
          actionProgress={null}
        />
      );

      // Empty wingetRefs — shows as unmatched standalone row
      expect(screen.getByText('Visual Studio Code')).toBeInTheDocument();
    });
  });

  describe('configModuleMap path (setup/preview results)', () => {
    function makeSetupResult(overrides: Partial<ActionResult> = {}): ActionResult {
      return {
        action: 'setup',
        status: 'success',
        summary: '2 to install, 1 already present',
        appEvents: [
          { app: 'Microsoft.VisualStudioCode', action: 'To install', statusKey: 'to_install', phase: 'apply' as never },
          { app: 'Git.Git', action: 'OK', statusKey: 'present', phase: 'apply' as never },
        ],
        counts: { toInstall: 2, alreadyPresent: 1, manifestTotal: 3 },
        wasPreview: true,
        ...overrides,
      };
    }

    it('shows settings badge when configModuleMap maps winget ID to module name', () => {
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeSetupResult({
            configModuleMap: { 'Microsoft.VisualStudioCode': 'vscode' },
          })}
          actionProgress={null}
        />
      );

      // The VS Code row should have a "Settings" badge via configModuleMap
      const badges = screen.getAllByTestId('config-captured');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('does not show settings badge when configModuleMap is absent', () => {
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeSetupResult()}
          actionProgress={null}
        />
      );

      const badges = screen.queryAllByTestId('config-captured');
      expect(badges).toHaveLength(0);
    });
  });
});
