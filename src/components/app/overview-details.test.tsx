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

    // Expand setup card
    const setupCard = screen.getByTestId('overview-card-apply');
    fireEvent.click(setupCard);

    // Click Details button (get all and click the first one)
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

    // Expand setup card
    const setupCard = screen.getByTestId('overview-card-apply');
    fireEvent.click(setupCard);

    // Click Details button (get all and click the first one)
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
    const checkResult = {
      action: 'check' as const,
      status: 'success' as const,
      summary: '2 missing, 58 present',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: {
        missing: 2,
        alreadyPresent: 58,
      },
      appEvents: [
        { app: 'MissingApp1', action: 'Missing' as const, timestamp: Date.now() },
        { app: 'MissingApp2', action: 'Missing' as const, timestamp: Date.now() },
      ],
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
          check: 'success',
        }}
        actionProgressByAction={{
          ...defaultPerActionState.actionProgressByAction,
          check: { message: '2 missing, 58 present' },
        }}
        actionResultByAction={{
          ...defaultPerActionState.actionResultByAction,
          check: checkResult,
        }}
        liveAppEvents={[]}
        liveCounters={{ installed: 0, alreadyPresent: 58, skipped: 0, failed: 0 }}
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

    // Expand check card
    const checkCard = screen.getByTestId('overview-card-check');
    fireEvent.click(checkCard);

    // Click Details button (get all and click the first one)
    const detailsButtons = screen.getAllByText('Details');
    fireEvent.click(detailsButtons[0]);

    // Verify modal shows check outcome
    expect(screen.getByText('Check Details')).toBeInTheDocument();
    expect(screen.getByText('2 missing, 58 present')).toBeInTheDocument();
    
    // Verify missing apps are shown
    expect(screen.getByText('MissingApp1')).toBeInTheDocument();
    expect(screen.getByText('MissingApp2')).toBeInTheDocument();
  });

  it.skip('should not show stale data from another action', () => {
    // Setup has completed with results
    const setupResult = {
      action: 'setup' as const,
      status: 'success' as const,
      summary: '5 installed',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: {
        installed: 5,
      },
    };

    // Check has also completed with different results
    const checkResult = {
      action: 'check' as const,
      status: 'success' as const,
      summary: '2 missing',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: {
        missing: 2,
      },
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
          capture: 'idle',
          setup: 'success',
          check: 'success',
        }}
        actionProgressByAction={{
          capture: null,
          setup: { message: '5 installed' },
          check: { message: '2 missing' },
        }}
        actionResultByAction={{
          capture: null,
          setup: setupResult,
          check: checkResult,
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

    // Click Details for Setup
    const setupCard = screen.getByTestId('overview-card-apply');
    fireEvent.click(setupCard);
    const setupDetailsButtons = screen.getAllByText('Details');
    fireEvent.click(setupDetailsButtons[0]);

    // Verify Setup details are shown
    expect(screen.getByText('Setup Details')).toBeInTheDocument();
    expect(screen.getAllByText('5 installed').length).toBeGreaterThan(0);
    expect(screen.queryByText('2 missing')).not.toBeInTheDocument();

    // Close modal
    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    // Click Details for Check
    const checkCard = screen.getByTestId('overview-card-check');
    fireEvent.click(checkCard);
    const checkDetailsButtons = screen.getAllByText('Details');
    fireEvent.click(checkDetailsButtons[0]);

    // Verify Check details are shown (not Setup)
    expect(screen.getByText('Check Details')).toBeInTheDocument();
    expect(screen.getAllByText('2 missing').length).toBeGreaterThan(0);
    expect(screen.queryByText('5 installed')).not.toBeInTheDocument();
  });
});
