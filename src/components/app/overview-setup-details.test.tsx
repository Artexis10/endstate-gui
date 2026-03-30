import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { OverviewScreen } from './overview-screen';
import type { LifecycleState } from '@/lib/lifecycle-state';
import type { DiscoveredProfile } from '@/file-discovery';
import type { AppEvent } from '@/lib/apply-utils';

// Mock settings to enable showDetails
vi.mock('@/settings', () => ({
  loadSettings: () => ({
    engineMode: 'bundled',
    customProfilesDirectory: '',
    lastSelectedProfile: '',
    lastSelectedProfilePath: '',
    dryRunEnabled: true,
    showDetails: true,
  }),
  saveSettings: vi.fn(),
}));

const createPerActionState = (overrides?: {
  setup?: { status: 'idle' | 'running' | 'success' | 'error'; result?: any };
}) => ({
  actionStatusByAction: {
    capture: 'idle' as const,
    setup: (overrides?.setup?.status ?? 'idle') as 'idle' | 'running' | 'success' | 'error',
    check: 'idle' as const
  },
  actionProgressByAction: { capture: null, setup: null, check: null },
  actionResultByAction: {
    capture: null,
    setup: overrides?.setup?.result ?? null,
    check: null
  },
});


describe('Setup Details Modal - Already Present vs Skipped', () => {
  const mockLifecycleState: LifecycleState = {
    lastCapture: null,
    lastPreview: null,
    lastApply: null,
    lastVerify: null,
  };

  const mockProfiles: DiscoveredProfile[] = [
    { name: 'test-profile', path: 'C:\\profiles\\test.json', displayName: 'Test Profile' },
  ];

  const defaultProps = {
    lifecycleState: mockLifecycleState,
    selectedProfile: 'test-profile',
    profiles: mockProfiles,
    profilesDirectory: 'C:\\profiles',
    isRunning: false,
    runningAction: null as any,
    actionStatus: 'idle' as const,
    actionProgress: null,
    actionResult: null,
    liveAppEvents: [],
    liveCounters: undefined,
    onNavigate: vi.fn(),
    onCapture: vi.fn(),
    onSetup: vi.fn(),
    onCheck: vi.fn(),
    onProfileChange: vi.fn(),
    onDismissResult: vi.fn(),
    onOpenProfilesFolder: vi.fn(),
    onRefreshProfiles: vi.fn(),
    onRenameProfile: vi.fn(),
    onDeleteProfile: vi.fn(),
    onRenameFile: vi.fn(),
  };

  it('REGRESSION: "Already present" tab shows apps with action="OK"', async () => {
    const user = userEvent.setup();

    const appEvents: AppEvent[] = [
      { app: 'Git.Git', action: 'To install', statusKey: 'to_install', phase: 'apply', timestamp: Date.now() },
      { app: 'VSCode', action: 'To install', statusKey: 'to_install', phase: 'apply', timestamp: Date.now() },
      { app: 'Chrome', action: 'OK', statusKey: 'present', phase: 'apply', timestamp: Date.now() },
      { app: 'Firefox', action: 'OK', statusKey: 'present', phase: 'apply', timestamp: Date.now() },
      { app: 'Notepad++', action: 'OK', statusKey: 'present', phase: 'apply', timestamp: Date.now() },
    ];

    const setupResult = {
      action: 'setup' as const,
      status: 'success' as const,
      summary: '2 to install, 3 already present',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: {
        toInstall: 2,
        alreadyPresent: 3,
      },
      appEvents,
      wasPreview: true,
    };

    // runningAction="setup" auto-syncs activeFlow to 'setup'
    render(
      <OverviewScreen
        {...createPerActionState({ setup: { status: 'success', result: setupResult } })}
        {...defaultProps}
        runningAction="setup"
        actionStatus="success"
        actionResult={setupResult}
      />
    );

    // Click "Details" button (auto-synced to setup flow, content visible)
    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    const viewDetailsButton = screen.getByText('Details');
    await user.click(viewDetailsButton);

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Setup Details')).toBeInTheDocument();
    });

    // Should show correct counts in pills
    expect(screen.getByText(/To install: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Already present: 3/i)).toBeInTheDocument();

    // Click "Already present" pill to filter
    const alreadyPresentPill = screen.getByText(/Already present: 3/i);
    await user.click(alreadyPresentPill);

    // Should show 3 apps (Chrome, Firefox, Notepad++)
    await waitFor(() => {
      expect(screen.getByText('Chrome')).toBeInTheDocument();
      expect(screen.getByText('Firefox')).toBeInTheDocument();
      expect(screen.getByText('Notepad++')).toBeInTheDocument();
    });

    // Should NOT show "To install" apps when filtered
    expect(screen.queryByText('Git.Git')).not.toBeInTheDocument();
    expect(screen.queryByText('VSCode')).not.toBeInTheDocument();

    // Apps should show "Already present" label
    const labels = screen.getAllByText('Already present');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('REGRESSION: apps skipped due to "already installed" show as "Already present" not "SKIPPED"', async () => {
    const user = userEvent.setup();

    const appEvents: AppEvent[] = [
      { app: 'Git.Git', action: 'To install', statusKey: 'to_install', phase: 'apply', timestamp: Date.now() },
      { app: 'VSCode', action: 'To install', statusKey: 'to_install', phase: 'apply', timestamp: Date.now() },
      { app: 'Chrome', action: 'OK', statusKey: 'present', phase: 'apply', timestamp: Date.now() },
      { app: 'Firefox', action: 'OK', statusKey: 'present', phase: 'apply', timestamp: Date.now() },
      { app: 'Notepad++', action: 'OK', statusKey: 'present', phase: 'apply', timestamp: Date.now() },
      { app: 'BlockedApp', action: 'Skipped', statusKey: 'skipped', phase: 'apply', timestamp: Date.now() },
    ];

    const setupResult = {
      action: 'setup' as const,
      status: 'success' as const,
      summary: '2 to install, 3 already present, 1 skipped',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: {
        toInstall: 2,
        alreadyPresent: 3,
        skipped: 1,
      },
      appEvents,
      wasPreview: true,
    };

    // runningAction="setup" auto-syncs activeFlow to 'setup'
    render(
      <OverviewScreen
        {...createPerActionState({ setup: { status: 'success', result: setupResult } })}
        {...defaultProps}
        runningAction="setup"
        actionStatus="success"
        actionResult={setupResult}
      />
    );

    // Click "Details" button (auto-synced to setup flow, content visible)
    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    const viewDetailsButton = screen.getByText('Details');
    await user.click(viewDetailsButton);

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Setup Details')).toBeInTheDocument();
    });

    // Should show correct counts in pills
    expect(screen.getByText(/To install: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Already present: 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Skipped: 1/i)).toBeInTheDocument();

    // Click "Already present" pill
    const alreadyPresentPill = screen.getByText(/Already present: 3/i);
    await user.click(alreadyPresentPill);

    await waitFor(() => {
      expect(screen.getByText('Chrome')).toBeInTheDocument();
      expect(screen.getByText('Firefox')).toBeInTheDocument();
      expect(screen.getByText('Notepad++')).toBeInTheDocument();
    });

    expect(screen.queryByText('BlockedApp')).not.toBeInTheDocument();

    const labels = screen.getAllByText('Already present');
    expect(labels.length).toBeGreaterThan(0);

    // Click "Skipped" pill
    const skippedPill = screen.getByText(/Skipped: 1/i);
    await user.click(skippedPill);

    await waitFor(() => {
      expect(screen.getByText('BlockedApp')).toBeInTheDocument();
    });

    expect(screen.queryByText('Chrome')).not.toBeInTheDocument();
    expect(screen.queryByText('Firefox')).not.toBeInTheDocument();
    expect(screen.queryByText('Notepad++')).not.toBeInTheDocument();
  });

  it('REGRESSION: "To install" pill label is not truncated', async () => {
    const user = userEvent.setup();

    const setupResult = {
      action: 'setup' as const,
      status: 'success' as const,
      summary: '50 to install, 10 already present',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: {
        toInstall: 50,
        alreadyPresent: 10,
      },
      appEvents: [],
      wasPreview: true,
    };

    // runningAction="setup" auto-syncs activeFlow to 'setup'
    render(
      <OverviewScreen
        {...createPerActionState({ setup: { status: 'success', result: setupResult } })}
        {...defaultProps}
        runningAction="setup"
        actionStatus="success"
        actionResult={setupResult}
      />
    );

    // Click "Details" (auto-synced to setup flow, content visible)
    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    const viewDetailsButton = screen.getByText('Details');
    await user.click(viewDetailsButton);

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Setup Details')).toBeInTheDocument();
    });

    // "To install" pill should show full text
    const toInstallPill = screen.getByText(/To install: 50/i);
    expect(toInstallPill).toBeInTheDocument();
    expect(toInstallPill).toBeVisible();

    expect(toInstallPill.textContent).toContain('To install');
    expect(toInstallPill.textContent).toContain('50');
  });
});
