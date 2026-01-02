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
    engineScriptPath: '',
    customProfilesDirectory: '',
    lastSelectedProfile: '',
    lastSelectedProfilePath: '',
    dryRunEnabled: true,
    showDetails: true, // Enable showDetails for tests
  }),
  saveSettings: vi.fn(),
}));

/**
 * REGRESSION TEST: Setup Details modal bugs
 * 
 * Issues to fix:
 * 1. "Already present" apps showing as "SKIPPED" in live activity
 * 2. "Already present" tab in Setup Details modal shows nothing
 * 3. "To install" pill label truncated/cut off
 */
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

    render(
      <OverviewScreen
        {...defaultProps}
        runningAction="setup"
        actionStatus="success"
        actionResult={setupResult}
      />
    );

    // Expand Setup card
    const setupCard = screen.getByTestId('overview-card-apply');
    await user.click(setupCard);

    // Click "Details" button
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

    // Apps should show "Already present" label, not "OK"
    const labels = screen.getAllByText('Already present');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('REGRESSION: apps skipped due to "already installed" show as "Already present" not "SKIPPED"', async () => {
    const user = userEvent.setup();
    
    // Simulate the bug: engine outputs [SKIP] with "already installed" reason
    // Live activity should show "PRESENT" (not "SKIPPED")
    // Modal should show under "Already present" tab (not "Skipped")
    const appEvents: AppEvent[] = [
      { app: 'Git.Git', action: 'To install', statusKey: 'to_install', phase: 'apply', timestamp: Date.now() },
      { app: 'VSCode', action: 'To install', statusKey: 'to_install', phase: 'apply', timestamp: Date.now() },
      // These were parsed from [SKIP] ... - already installed
      // After fix, parseApplyProgressLine returns action='OK' not 'Skipped'
      { app: 'Chrome', action: 'OK', statusKey: 'present', phase: 'apply', timestamp: Date.now() },
      { app: 'Firefox', action: 'OK', statusKey: 'present', phase: 'apply', timestamp: Date.now() },
      { app: 'Notepad++', action: 'OK', statusKey: 'present', phase: 'apply', timestamp: Date.now() },
      // This is a true skip (filtered)
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

    render(
      <OverviewScreen
        {...defaultProps}
        runningAction="setup"
        actionStatus="success"
        actionResult={setupResult}
      />
    );

    // Expand Setup card
    const setupCard = screen.getByTestId('overview-card-apply');
    await user.click(setupCard);

    // Click "Details" button
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

    // Click "Already present" pill to filter
    const alreadyPresentPill = screen.getByText(/Already present: 3/i);
    await user.click(alreadyPresentPill);

    // Should show 3 apps (Chrome, Firefox, Notepad++) - NOT BlockedApp
    await waitFor(() => {
      expect(screen.getByText('Chrome')).toBeInTheDocument();
      expect(screen.getByText('Firefox')).toBeInTheDocument();
      expect(screen.getByText('Notepad++')).toBeInTheDocument();
    });

    // BlockedApp should NOT appear under "Already present"
    expect(screen.queryByText('BlockedApp')).not.toBeInTheDocument();

    // Apps should show "Already present" label
    const labels = screen.getAllByText('Already present');
    expect(labels.length).toBeGreaterThan(0);

    // Click "Skipped" pill to verify BlockedApp is there
    const skippedPill = screen.getByText(/Skipped: 1/i);
    await user.click(skippedPill);

    await waitFor(() => {
      expect(screen.getByText('BlockedApp')).toBeInTheDocument();
    });

    // Chrome/Firefox/Notepad++ should NOT appear under "Skipped"
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

    render(
      <OverviewScreen
        {...defaultProps}
        runningAction="setup"
        actionStatus="success"
        actionResult={setupResult}
      />
    );

    // Expand Setup card
    const setupCard = screen.getByTestId('overview-card-apply');
    await user.click(setupCard);

    // Click "Details"
    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument();
    });
    
    const viewDetailsButton = screen.getByText('Details');
    await user.click(viewDetailsButton);

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Setup Details')).toBeInTheDocument();
    });

    // "To install" pill should show full text including count
    const toInstallPill = screen.getByText(/To install: 50/i);
    expect(toInstallPill).toBeInTheDocument();
    expect(toInstallPill).toBeVisible();
    
    // Text should not be truncated (check that both label and number are present)
    expect(toInstallPill.textContent).toContain('To install');
    expect(toInstallPill.textContent).toContain('50');
  });

});
