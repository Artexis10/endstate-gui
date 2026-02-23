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
    it('matches config module to app via appId', () => {
      const configModules: CaptureConfigModule[] = [
        { id: 'apps.vscode', appId: 'vscode', displayName: 'Visual Studio Code', status: 'captured', filesCaptured: 5 },
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

    it('falls back to appId when wingetRefs present but no match', () => {
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

      // wingetRefs has no match, but appId "vscode" matches "Microsoft.VisualStudioCode" via fallback
      const badges = screen.getAllByTestId('config-captured');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('falls back to appId when wingetRefs is empty array', () => {
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

      // Empty wingetRefs, falls back to appId "vscode" matching "Microsoft.VisualStudioCode"
      const badges = screen.getAllByTestId('config-captured');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('legacy fallback (no configModules)', () => {
    it('falls back to heuristic when configModules is absent', () => {
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({
            configModules: undefined,
            configsIncluded: ['vscode-extensions'],
            configsCaptureErrors: [],
          })}
          actionProgress={null}
        />
      );

      // Legacy heuristic: "vscode" matches "Microsoft.VisualStudioCode"
      const badges = screen.getAllByTestId('config-captured');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('falls back to heuristic when configModules is empty array', () => {
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({
            configModules: [],
            configsIncluded: ['obsidian'],
            configsCaptureErrors: [],
          })}
          actionProgress={null}
        />
      );

      // Legacy heuristic: "obsidian" matches "Obsidian.Obsidian"
      const badges = screen.getAllByTestId('config-captured');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('shows unmatched legacy configs by raw ID', () => {
      render(
        <ActionDetailsModal
          open={true}
          onOpenChange={noop}
          actionResult={makeResult({
            configModules: undefined,
            configsIncluded: ['some-unknown-config'],
            configsCaptureErrors: [],
          })}
          actionProgress={null}
        />
      );

      expect(screen.getByText('some-unknown-config')).toBeInTheDocument();
    });
  });
});
