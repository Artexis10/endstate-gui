import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../test/test-utils';
import { seedLocalStorage } from '../../test/localStorage-helpers';
import { CaptureResultModal } from './capture-result-modal';
import type { CapturedApp, CaptureCounts } from '../../types';

// Mock useShowDetails to control Details visibility in tests
vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => true), // Default to true so Details section renders
}));

describe('CaptureResultModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const mockCounts: CaptureCounts = {
    totalFound: 10,
    included: 8,
    skipped: 2,
    filteredRuntimes: 0,
    filteredStoreApps: 0,
    sensitiveExcludedCount: 0,
  };

  const mockApps: CapturedApp[] = [
    { id: 'App1', source: 'winget' },
    { id: 'App2', source: 'winget' },
    { id: 'App3', source: 'scoop' },
  ];

  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    counts: mockCounts,
    appsIncluded: mockApps,
    outputPath: 'C:\\profiles\\setup_2024-12-24.jsonc',
  };

  describe('Details collapse behavior', () => {
    it('starts with details collapsed on initial open', () => {
      renderWithProviders(<CaptureResultModal {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /details \(/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
      
      expect(screen.queryByText(/winget/i)).not.toBeInTheDocument();
    });

    it('expands details when toggle button is clicked', async () => {
      renderWithProviders(<CaptureResultModal {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /details \(/i });
      toggleButton.click();

      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      });

      expect(screen.getByText(/winget/i)).toBeInTheDocument();
    });

    it('collapses details when toggle button is clicked again', async () => {
      renderWithProviders(<CaptureResultModal {...defaultProps} />);

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
        'capture-modal-details-expanded': 'true',
        'showTechnicalDetails': 'true',
      });

      renderWithProviders(<CaptureResultModal {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /details \(/i });
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('resets to collapsed when modal is closed and reopened', async () => {
      const { unmount } = renderWithProviders(<CaptureResultModal {...defaultProps} />);

      const toggleButton = screen.getByRole('button', { name: /details \(/i });
      toggleButton.click();
      
      await waitFor(() => {
        expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      });

      unmount();
      
      renderWithProviders(<CaptureResultModal {...defaultProps} />);

      const newToggleButton = screen.getByRole('button', { name: /details \(/i });
      expect(newToggleButton).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Modal close behavior', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      renderWithProviders(<CaptureResultModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByRole('button', { name: /done/i });
      closeButton.click();

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape key', async () => {
      const onClose = vi.fn();
      renderWithProviders(<CaptureResultModal {...defaultProps} onClose={onClose} />);

      const dialog = screen.getByRole('dialog');
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Content rendering', () => {
    it('displays capture counts', () => {
      renderWithProviders(<CaptureResultModal {...defaultProps} />);

      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText(/apps captured/i)).toBeInTheDocument();
    });

    it('displays output path filename', () => {
      renderWithProviders(<CaptureResultModal {...defaultProps} />);

      expect(screen.getByText(/setup_2024-12-24\.jsonc/i)).toBeInTheDocument();
    });

    it('shows details count in toggle button', () => {
      renderWithProviders(<CaptureResultModal {...defaultProps} />);

      expect(screen.getByText(/details \(3 apps\)/i)).toBeInTheDocument();
    });
  });

  describe('No persistence behavior', () => {
    it('does not write details state to localStorage', async () => {
      localStorage.clear();
      
      renderWithProviders(<CaptureResultModal {...defaultProps} />);

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
      
      renderWithProviders(<CaptureResultModal {...defaultProps} />);

      // Details button should not be present when setting is OFF
      expect(screen.queryByRole('button', { name: /details \(/i })).not.toBeInTheDocument();
    });
  });
});
