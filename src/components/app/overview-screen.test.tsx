import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { OverviewScreen } from './overview-screen';
import type { LifecycleState } from '@/lib/lifecycle-state';
import type { DiscoveredProfile } from '@/file-discovery';

describe('OverviewScreen - Setup Actions', () => {
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

  it('renders Preview button in Setup flow when selected', async () => {
    const user = userEvent.setup();
    render(<OverviewScreen {...defaultProps} />);

    // Click to enter setup flow
    const setupCard = screen.getByTestId('flow-setup');
    await user.click(setupCard);

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });
  });

  it('calls onSetup with preview intent when Preview button clicked', async () => {
    const onSetup = vi.fn();
    const user = userEvent.setup();
    render(<OverviewScreen {...defaultProps} onSetup={onSetup} />);

    // Enter setup flow
    const setupCard = screen.getByTestId('flow-setup');
    await user.click(setupCard);

    // Click Preview button
    await waitFor(() => {
      const previewButton = screen.getByText('Preview changes');
      user.click(previewButton);
    });

    await waitFor(() => {
      expect(onSetup).toHaveBeenCalledWith('preview', undefined);
    });
  });

  it('shows Run again button after setup completion', async () => {
    const actionResult = {
      action: 'setup' as const,
      status: 'success' as const,
      summary: '5 installed, 3 already present',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: { installed: 5, alreadyPresent: 3 },
      wasPreview: false,
    };

    // When runningAction is 'setup', activeFlow auto-syncs to 'setup'
    render(
      <OverviewScreen
        {...defaultProps}
        runningAction="setup"
        actionStatus="success"
        actionResult={actionResult}
        actionStatusByAction={{
          capture: 'idle',
          setup: 'success',
          check: 'idle',
        }}
        actionResultByAction={{
          capture: null,
          setup: actionResult,
          check: null,
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Run again')).toBeInTheDocument();
    });
  });

  it('does not show Run again for preview results', async () => {
    const actionResult = {
      action: 'setup' as const,
      status: 'success' as const,
      summary: '5 to install, 3 already present',
      profile: 'test-profile',
      timestamp: new Date().toISOString(),
      counts: { toInstall: 5, alreadyPresent: 3 },
      wasPreview: true,
    };

    // When runningAction is 'setup', activeFlow auto-syncs to 'setup'
    render(
      <OverviewScreen
        {...defaultProps}
        runningAction="setup"
        actionStatus="success"
        actionResult={actionResult}
        actionStatusByAction={{
          capture: 'idle',
          setup: 'success',
          check: 'idle',
        }}
        actionResultByAction={{
          capture: null,
          setup: actionResult,
          check: null,
        }}
      />
    );

    await waitFor(() => {
      // Should show "Apply changes" instead of "Run again"
      expect(screen.getByText('Apply changes')).toBeInTheDocument();
      expect(screen.queryByText('Run again')).not.toBeInTheDocument();
    });
  });

  it('shows FlowSelector when no profile selected', () => {
    render(<OverviewScreen {...defaultProps} selectedProfile="" profiles={[]} />);

    // FlowSelector should be visible
    expect(screen.getByTestId('flow-selector')).toBeInTheDocument();
  });

  it('shows FlowSelector when profile is selected', () => {
    render(<OverviewScreen {...defaultProps} />);

    // FlowSelector is always visible as the primary UI
    expect(screen.getByTestId('flow-selector')).toBeInTheDocument();
  });
});
