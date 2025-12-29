import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { OverviewScreen } from './overview-screen';
import type { LifecycleState } from '@/lib/lifecycle-state';
import type { DiscoveredProfile } from '@/file-discovery';
import type { AppEvent } from '@/lib/apply-utils';

/**
 * REGRESSION TEST: Capture Details modal bugs
 * 
 * Issue: Capture items showing as "Skipped" instead of "Detected"
 * Root cause: appEvents need statusKey='already_present' and phase='capture' for phase-aware mapping
 */
describe('Capture Details Modal - Detected vs Skipped', () => {
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
    uiMode: 'default' as const,
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

  it('REGRESSION: Capture Details shows "Detected" not "Skipped" for captured apps', async () => {
    const user = userEvent.setup();
    
    // Simulate capture result with phase-aware appEvents
    const appEvents: AppEvent[] = [
      { app: 'Git.Git', action: 'Captured', statusKey: 'detected', phase: 'capture', timestamp: Date.now() },
      { app: 'VSCode', action: 'Captured', statusKey: 'detected', phase: 'capture', timestamp: Date.now() },
      { app: 'Chrome', action: 'Captured', statusKey: 'detected', phase: 'capture', timestamp: Date.now() },
    ];

    const captureResult = {
      action: 'capture' as const,
      status: 'success' as const,
      summary: '3 apps captured',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: {
        total: 3,
      },
      appEvents,
    };

    render(
      <OverviewScreen
        {...defaultProps}
        runningAction="capture"
        actionStatus="success"
        actionResult={captureResult}
      />
    );

    // Expand Capture card
    const captureCard = screen.getByTestId('overview-card-capture');
    await user.click(captureCard);

    // Click "View details" button
    await waitFor(() => {
      expect(screen.getByText('View details')).toBeInTheDocument();
    });
    
    const viewDetailsButton = screen.getByText('View details');
    await user.click(viewDetailsButton);

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Capture Details')).toBeInTheDocument();
    });

    // Apps should show "Detected" label, NOT "Skipped"
    await waitFor(() => {
      const detectedLabels = screen.getAllByText('Detected');
      expect(detectedLabels.length).toBe(3); // One for each app
    });

    // Should NOT show "Skipped" anywhere
    expect(screen.queryByText('Skipped')).not.toBeInTheDocument();

    // Verify all apps are visible
    expect(screen.getByText('Git.Git')).toBeInTheDocument();
    expect(screen.getByText('VSCode')).toBeInTheDocument();
    expect(screen.getByText('Chrome')).toBeInTheDocument();
  });

  it('REGRESSION: Capture Details uses correct color for "Detected" (success/green)', async () => {
    const user = userEvent.setup();
    
    const appEvents: AppEvent[] = [
      { app: 'Git.Git', action: 'Captured', statusKey: 'detected', phase: 'capture', timestamp: Date.now() },
    ];

    const captureResult = {
      action: 'capture' as const,
      status: 'success' as const,
      summary: '1 app captured',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: {
        total: 1,
      },
      appEvents,
    };

    render(
      <OverviewScreen
        {...defaultProps}
        runningAction="capture"
        actionStatus="success"
        actionResult={captureResult}
      />
    );

    const captureCard = screen.getByTestId('overview-card-capture');
    await user.click(captureCard);

    await waitFor(() => {
      expect(screen.getByText('View details')).toBeInTheDocument();
    });
    
    const viewDetailsButton = screen.getByText('View details');
    await user.click(viewDetailsButton);

    await waitFor(() => {
      expect(screen.getByText('Capture Details')).toBeInTheDocument();
    });

    // Find the "Detected" label chip
    const detectedLabel = screen.getByText('Detected');
    expect(detectedLabel).toBeInTheDocument();

    // Check that it has detected color classes (teal, not green)
    const chipElement = detectedLabel.closest('span');
    expect(chipElement).toHaveClass('bg-teal-500/10');
    // Verify it's NOT using success/green colors
    expect(chipElement).not.toHaveClass('text-success');
    expect(chipElement).not.toHaveClass('bg-success/10');
  });
});
