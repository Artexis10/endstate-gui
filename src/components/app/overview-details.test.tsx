/**
 * Tests for Details modal functionality with per-action state
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverviewScreen } from './overview-screen';
import type { LifecycleState } from '@/lib/lifecycle-state';
import type { DiscoveredProfile } from '@/file-discovery';

const mockLifecycleState: LifecycleState = {
  lastCapture: null,
  lastPreview: null,
  lastApply: null,
  lastVerify: null,
};

const mockProfiles: DiscoveredProfile[] = [
  { name: 'test-profile', displayName: 'Test Profile', path: '/test/path.jsonc' }
];

const defaultPerActionState = {
  actionStatusByAction: {
    capture: 'idle' as const,
    setup: 'idle' as const,
    check: 'idle' as const,
  },
  actionProgressByAction: {
    capture: null,
    setup: null,
    check: null,
  },
  actionResultByAction: {
    capture: null,
    setup: null,
    check: null,
  },
};

describe('Overview Details Modal - Per-Action State', () => {
  it('should show Setup Preview details after completion (runningAction cleared)', () => {
    const previewResult = {
      action: 'setup' as const,
      status: 'success' as const,
      summary: '5 to install, 3 already present',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: {
        toInstall: 5,
        alreadyPresent: 3,
      },
      wasPreview: true,
    };

    render(
      <OverviewScreen
        lifecycleState={mockLifecycleState}
        selectedProfile="test-profile"
        profiles={mockProfiles}
        profilesDirectory="/test"
        isRunning={false}
        runningAction={null}
        actionStatus="idle"
        actionProgress={null}
        actionResult={null}
        actionStatusByAction={{
          ...defaultPerActionState.actionStatusByAction,
          setup: 'success',
        }}
        actionProgressByAction={{
          ...defaultPerActionState.actionProgressByAction,
          setup: { message: '5 to install, 3 already present' },
        }}
        actionResultByAction={{
          ...defaultPerActionState.actionResultByAction,
          setup: previewResult,
        }}
        liveAppEvents={[]}
        liveCounters={{ installed: 0, alreadyPresent: 0, skipped: 0, failed: 0 }}
        onNavigate={vi.fn()}
        onCapture={vi.fn()}
        onSetup={vi.fn()}
        onCheck={vi.fn()}
        onProfileChange={vi.fn()}
        onDismissResult={vi.fn()}
        onOpenProfilesFolder={vi.fn()}
        onRefreshProfiles={vi.fn()}
      />
    );

    // Enter setup flow to see the action content
    const setupCard = screen.getByTestId('flow-setup');
    fireEvent.click(setupCard);

    // Click Details button
    const detailsButtons = screen.getAllByText('Details');
    fireEvent.click(detailsButtons[0]);

    // Verify modal shows preview summary
    expect(screen.getByText('Setup Details')).toBeInTheDocument();
    expect(screen.getAllByText('5 to install, 3 already present').length).toBeGreaterThan(0);
  });

  it('should show Setup Apply details after completion (runningAction cleared)', () => {
    const applyResult = {
      action: 'setup' as const,
      status: 'success' as const,
      summary: '5 installed, 3 already present',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: {
        installed: 5,
        alreadyPresent: 3,
      },
      appEvents: [
        { app: 'App1', action: 'Installed' as const, timestamp: Date.now() },
        { app: 'App2', action: 'Installed' as const, timestamp: Date.now() },
        { app: 'App3', action: 'OK' as const, timestamp: Date.now() },
      ],
      wasPreview: false,
    };

    render(
      <OverviewScreen
        lifecycleState={mockLifecycleState}
        selectedProfile="test-profile"
        profiles={mockProfiles}
        profilesDirectory="/test"
        isRunning={false}
        runningAction={null}
        actionStatus="idle"
        actionProgress={null}
        actionResult={null}
        actionStatusByAction={{
          ...defaultPerActionState.actionStatusByAction,
          setup: 'success',
        }}
        actionProgressByAction={{
          ...defaultPerActionState.actionProgressByAction,
          setup: { message: '5 installed, 3 already present' },
        }}
        actionResultByAction={{
          ...defaultPerActionState.actionResultByAction,
          setup: applyResult,
        }}
        liveAppEvents={[]}
        liveCounters={{ installed: 5, alreadyPresent: 3, skipped: 0, failed: 0 }}
        onNavigate={vi.fn()}
        onCapture={vi.fn()}
        onSetup={vi.fn()}
        onCheck={vi.fn()}
        onProfileChange={vi.fn()}
        onDismissResult={vi.fn()}
        onOpenProfilesFolder={vi.fn()}
        onRefreshProfiles={vi.fn()}
      />
    );

    // Enter setup flow to see the action content
    const setupCard = screen.getByTestId('flow-setup');
    fireEvent.click(setupCard);

    // Click Details button
    const detailsButtons = screen.getAllByText('Details');
    fireEvent.click(detailsButtons[0]);

    // Verify modal shows apply outcome
    expect(screen.getByText('Setup Details')).toBeInTheDocument();
    expect(screen.getAllByText('5 installed, 3 already present').length).toBeGreaterThan(0);

    // Verify app events are shown
    expect(screen.getByText('App1')).toBeInTheDocument();
    expect(screen.getByText('App2')).toBeInTheDocument();
    expect(screen.getByText('App3')).toBeInTheDocument();
  });

  it.skip('should show Check details after completion (runningAction cleared)', () => {
    // Skipped: Check action not yet integrated into setup flow
  });

  it.skip('should not show stale data from another action', () => {
    // Skipped: Check action not yet integrated into setup flow
  });
});
