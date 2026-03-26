import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../test/test-utils';
import { seedLocalStorage } from '../../test/localStorage-helpers';
import { ApplyResultModal } from './apply-result-modal';
import type { ApplyItem, ApplyCounts, RestoreSummary } from '../../types';

// Mock useShowDetails to control Details visibility in tests
vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => true), // Default to true so Details section renders
}));

describe('ApplyResultModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const mockCounts: ApplyCounts = {
    total: 10,
    installed: 0,
    alreadyInstalled: 8,
    skippedFiltered: 0,
    failed: 2,
  };

  const mockItems: ApplyItem[] = [
    { id: 'App1', driver: 'winget', status: 'ok', reason: 'would_install' },
    { id: 'App2', driver: 'winget', status: 'ok', reason: 'already_installed' },
    { id: 'App3', driver: 'scoop', status: 'failed', reason: 'failed', message: 'Not found' },
  ];

  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    counts: mockCounts,
    items: mockItems,
    isDryRun: true,
  };

  describe('Details collapse behavior', () => {
    it('starts with details collapsed on initial open', () => {
      renderWithProviders(<ApplyResultModal {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /details \(/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      
      expect(screen.queryByText('App1')).not.toBeInTheDocument();
    });

    it('expands details when toggle button is clicked', async () => {
      renderWithProviders(<ApplyResultModal {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /details \(/i });
      toggleButton.click();

      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      });

      expect(screen.getByText('App1')).toBeInTheDocument();
      expect(screen.getByText('App2')).toBeInTheDocument();
      expect(screen.getByText('App3')).toBeInTheDocument();
    });

    it('collapses details when toggle button is clicked again', async () => {
      renderWithProviders(<ApplyResultModal {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /details \(/i });
      
      toggleButton.click();
      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      });

      toggleButton.click();
      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('REGRESSION: starts collapsed even if localStorage has expanded state', () => {
      seedLocalStorage({ 
        'apply-modal-details-expanded': 'true',
        'showDetails': 'true',
      });

      renderWithProviders(<ApplyResultModal {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /details \(/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('resets to collapsed when modal is closed and reopened', async () => {
      const { unmount } = renderWithProviders(<ApplyResultModal {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /details \(/i });
      toggleButton.click();
      
      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      });

      unmount();
      
      renderWithProviders(<ApplyResultModal {...defaultProps} />);

      const newToggleButton = screen.getByRole('button', { name: /details \(/i });
      expect(newToggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Modal close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      renderWithProviders(<ApplyResultModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /cancel/i });
      closeButton.click();

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape key', async () => {
      const onClose = vi.fn();
      renderWithProviders(<ApplyResultModal {...defaultProps} onClose={onClose} />);

      const dialog = screen.getByRole('dialog');
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('prevents closing on Escape when applying', async () => {
      const onClose = vi.fn();
      renderWithProviders(<ApplyResultModal {...defaultProps} isApplying={true} onClose={onClose} />);

      const dialog = screen.getByRole('dialog');
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Content rendering', () => {
    it('displays preview title for dry run', () => {
      const previewItems: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'would_install' },
        { id: 'App2', driver: 'winget', status: 'ok', reason: 'already_installed' },
      ];
      const props = {
        ...defaultProps,
        items: previewItems,
        counts: { total: 2, installed: 0, alreadyInstalled: 1, skippedFiltered: 0, failed: 0 },
      };
      
      renderWithProviders(<ApplyResultModal {...props} />);

      expect(screen.getByText(/here's what will change/i)).toBeTruthy();
    });

    it('displays completion title for actual apply with no failures', () => {
      const successItems: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
        { id: 'App2', driver: 'winget', status: 'ok', reason: 'already_installed' },
      ];
      const props = {
        ...defaultProps,
        isDryRun: false,
        counts: { total: 2, installed: 1, alreadyInstalled: 1, skippedFiltered: 0, failed: 0 },
        items: successItems,
      };
      
      renderWithProviders(<ApplyResultModal {...props} />);

      expect(screen.getByText(/your computer is ready/i)).toBeTruthy();
    });

    it('shows details count in toggle button', () => {
      renderWithProviders(<ApplyResultModal {...defaultProps} />);

      expect(screen.getByText(/details \(3 apps\)/i)).toBeInTheDocument();
    });
  });

  describe('No persistence behavior', () => {
    it('does not write details state to localStorage', async () => {
      localStorage.clear();
      
      renderWithProviders(<ApplyResultModal {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /details \(/i });
      toggleButton.click();

      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      });

      const keys = Object.keys(localStorage);
      const hasDetailsKey = keys.some(k => k.includes('details') || k.includes('expanded') || k.includes('technical'));
      expect(hasDetailsKey).toBe(false);
    });
  });

  describe('Details visibility gating', () => {
    it('hides Details section when showDetails setting is OFF', async () => {
      const { useShowDetails } = await import('@/lib/use-show-details');
      vi.mocked(useShowDetails).mockReturnValue(false);
      
      renderWithProviders(<ApplyResultModal {...defaultProps} />);

      // Details button should not be present when setting is OFF
      expect(screen.queryByRole('button', { name: /details \(/i })).not.toBeInTheDocument();
    });
  });

  describe('Apply button behavior', () => {
    it('shows apply button in preview mode with pending changes', () => {
      renderWithProviders(<ApplyResultModal {...defaultProps} onApplyChanges={vi.fn()} />);

      expect(screen.getByRole('button', { name: /apply changes/i })).toBeInTheDocument();
    });

    it('disables apply button when applying', () => {
      renderWithProviders(<ApplyResultModal {...defaultProps} isApplying={true} onApplyChanges={vi.fn()} />);

      const applyButton = screen.getByRole('button', { name: /applying/i });
      expect(applyButton).toBeDisabled();
    });
  });

  describe('Restore section', () => {
    const restoreSummary: RestoreSummary = {
      total: 5,
      restored: 3,
      skipped: 1,
      failed: 1,
      backupLocation: 'C:\\backups\\2025-01-01',
    };

    const applyProps = {
      ...defaultProps,
      isDryRun: false,
      counts: { total: 2, installed: 1, alreadyInstalled: 1, skippedFiltered: 0, failed: 0 },
      items: [
        { id: 'App1', driver: 'winget', status: 'ok' as const, reason: 'installed' },
        { id: 'App2', driver: 'winget', status: 'skipped' as const, reason: 'already_installed' },
      ],
    };

    it('shows restore summary when restoreSummary is provided', () => {
      renderWithProviders(
        <ApplyResultModal {...applyProps} restoreSummary={restoreSummary} />
      );

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // restored count
    });

    it('shows backup location', () => {
      renderWithProviders(
        <ApplyResultModal {...applyProps} restoreSummary={restoreSummary} />
      );

      expect(screen.getByText(/C:\\backups\\2025-01-01/)).toBeInTheDocument();
    });

    it('does not show restore section when restoreSummary is absent', () => {
      renderWithProviders(<ApplyResultModal {...applyProps} />);

      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('shows revert button when restoreSummary has restorations and onRevertSettings is provided', () => {
      const onRevert = vi.fn();
      renderWithProviders(
        <ApplyResultModal
          {...applyProps}
          restoreSummary={restoreSummary}
          onRevertSettings={onRevert}
        />
      );

      const revertBtn = screen.getByRole('button', { name: /revert settings/i });
      expect(revertBtn).toBeInTheDocument();
      revertBtn.click();
      expect(onRevert).toHaveBeenCalledTimes(1);
    });

    it('does not show revert button in preview mode', () => {
      renderWithProviders(
        <ApplyResultModal
          {...defaultProps}
          restoreSummary={restoreSummary}
          onRevertSettings={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /revert settings/i })).not.toBeInTheDocument();
    });
  });

  describe('Manual app section', () => {
    const manualItems: ApplyItem[] = [
      {
        id: 'custom-tool',
        driver: 'manual',
        status: 'skipped',
        reason: 'manual_required',
        name: 'Custom Tool',
        manual: {
          verifyPath: 'C:\\Program Files\\CustomTool\\custom.exe',
          launch: 'https://example.com/download',
          instructions: 'Download and run the installer',
        },
      },
      { id: 'WingetApp', driver: 'winget', status: 'ok', reason: 'installed' },
      { id: 'PresentApp', driver: 'winget', status: 'skipped', reason: 'already_installed' },
    ];

    const manualProps = {
      ...defaultProps,
      isDryRun: false,
      items: manualItems,
      counts: { total: 3, installed: 1, alreadyInstalled: 1, skippedFiltered: 0, failed: 1 },
    };

    it('renders "Install manually" section for manual_required apps', () => {
      renderWithProviders(<ApplyResultModal {...manualProps} />);
      expect(screen.getByTestId('manual-install-section')).toBeInTheDocument();
      expect(screen.getByText('Install manually')).toBeInTheDocument();
    });

    it('shows app display name from name field', () => {
      renderWithProviders(<ApplyResultModal {...manualProps} />);
      expect(screen.getByText('Custom Tool')).toBeInTheDocument();
    });

    it('shows instructions text', () => {
      renderWithProviders(<ApplyResultModal {...manualProps} />);
      expect(screen.getByText('Download and run the installer')).toBeInTheDocument();
    });

    it('renders download link when launch URL is present', () => {
      renderWithProviders(<ApplyResultModal {...manualProps} />);
      const link = screen.getByText('Open download page');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', 'https://example.com/download');
      expect(link.closest('a')).toHaveAttribute('target', '_blank');
    });

    it('shows footer text about re-running', () => {
      renderWithProviders(<ApplyResultModal {...manualProps} />);
      expect(screen.getByText(/after installing, run again/i)).toBeInTheDocument();
    });

    it('does not show download link when launch URL is absent', () => {
      const noLaunchItems: ApplyItem[] = [
        {
          id: 'no-launch-app',
          driver: 'manual',
          status: 'skipped',
          reason: 'manual_required',
          name: 'No Launch App',
          manual: {
            verifyPath: 'C:\\path\\to\\app.exe',
            instructions: 'Install it manually',
          },
        },
      ];
      renderWithProviders(
        <ApplyResultModal
          {...manualProps}
          items={noLaunchItems}
          counts={{ total: 1, installed: 0, alreadyInstalled: 0, skippedFiltered: 0, failed: 1 }}
        />
      );
      expect(screen.queryByText('Open download page')).not.toBeInTheDocument();
      expect(screen.getByText('Install it manually')).toBeInTheDocument();
    });

    it('does not show manual section when no manual_required items', () => {
      const wingetOnly: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
      ];
      renderWithProviders(
        <ApplyResultModal
          {...manualProps}
          items={wingetOnly}
          counts={{ total: 1, installed: 1, alreadyInstalled: 0, skippedFiltered: 0, failed: 0 }}
        />
      );
      expect(screen.queryByTestId('manual-install-section')).not.toBeInTheDocument();
    });

    it('renders both manual and winget apps in mixed result', () => {
      renderWithProviders(<ApplyResultModal {...manualProps} />);
      // Manual section exists
      expect(screen.getByTestId('manual-install-section')).toBeInTheDocument();
      // Installed count should be shown
      expect(screen.getByText('Installed this run')).toBeInTheDocument();
    });

    it('falls back to id when name is not present', () => {
      const noNameItems: ApplyItem[] = [
        {
          id: 'some-manual-app',
          driver: 'manual',
          status: 'skipped',
          reason: 'manual_required',
          manual: { verifyPath: 'C:\\path\\to\\app.exe' },
        },
      ];
      renderWithProviders(
        <ApplyResultModal
          {...manualProps}
          items={noNameItems}
          counts={{ total: 1, installed: 0, alreadyInstalled: 0, skippedFiltered: 0, failed: 1 }}
        />
      );
      expect(screen.getByText('some-manual-app')).toBeInTheDocument();
    });
  });
});
