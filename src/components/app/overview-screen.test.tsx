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

  it('renders Preview button in Setup card when expanded', async () => {
    const user = userEvent.setup();
    render(<OverviewScreen {...defaultProps} />);

    // Click to expand Setup card
    const setupCard = screen.getByTestId('overview-card-apply');
    await user.click(setupCard);

    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });
  });

  it('calls onSetup with preview intent when Preview button clicked', async () => {
    const onSetup = vi.fn();
    const user = userEvent.setup();
    render(<OverviewScreen {...defaultProps} onSetup={onSetup} />);

    // Expand Setup card
    const setupCard = screen.getByTestId('overview-card-apply');
    await user.click(setupCard);

    // Click Preview button
    await waitFor(() => {
      const previewButton = screen.getByText('Preview changes');
      user.click(previewButton);
    });

    await waitFor(() => {
      expect(onSetup).toHaveBeenCalledWith('preview');
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

    const user = userEvent.setup();
    render(
      <OverviewScreen
        {...defaultProps}
        runningAction="setup"
        actionStatus="success"
        actionResult={actionResult}
      />
    );

    // Expand Setup card
    const setupCard = screen.getByTestId('overview-card-apply');
    await user.click(setupCard);

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

    const user = userEvent.setup();
    render(
      <OverviewScreen
        {...defaultProps}
        runningAction="setup"
        actionStatus="success"
        actionResult={actionResult}
      />
    );

    // Expand Setup card
    const setupCard = screen.getByTestId('overview-card-apply');
    await user.click(setupCard);

    await waitFor(() => {
      // Should show "Apply changes" instead of "Run again"
      expect(screen.getByText('Apply changes')).toBeInTheDocument();
      expect(screen.queryByText('Run again')).not.toBeInTheDocument();
    });
  });

  it('disables Setup and Check when no profile selected', () => {
    render(<OverviewScreen {...defaultProps} selectedProfile="" profiles={[]} />);

    const setupCard = screen.getByTestId('overview-card-apply');
    const checkCard = screen.getByTestId('overview-card-verify');

    expect(setupCard).toHaveClass('opacity-50');
    expect(checkCard).toHaveClass('opacity-50');
  });
});
