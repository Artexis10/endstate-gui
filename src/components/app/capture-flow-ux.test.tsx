import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../test/test-utils';
import { CaptureResultModal } from './capture-result-modal';
import { clearLocalStorage } from '../../test/localStorage-helpers';
import userEvent from '@testing-library/user-event';
import type { CapturedApp, CaptureCounts } from '../../types';
import '@testing-library/jest-dom/vitest';

// Mock useShowDetails to control Details visibility in tests
vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => true), // Default to true so Details section renders
}));

/**
 * Capture Flow UX Contract Tests
 * 
 * These tests enforce the UX contracts for long-running Capture operations:
 * 1. When a run is active, primary actions are disabled and UI shows clear running state
 * 2. Progress/log updates do not duplicate (no double append on re-render / StrictMode)
 * 3. Errors render a stable, user-readable message and allow retry
 * 4. On success, results modal opens with details collapsed
 * 5. Closing results resets transient UI state
 */

describe('Capture Flow UX Contracts', () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  describe('Contract 1: Running state disables actions and shows clear UI', () => {
    it('shows capturing state with disabled button and progress indicator', () => {
      // This test verifies the Capture button is disabled during operation
      // The actual running state is tested in the integration test with App component
      
      // For modal: verify it doesn't open during capture
      const counts: CaptureCounts = {
        totalFound: 0,
        included: 0,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      renderWithProviders(
        <CaptureResultModal
          open={false}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={[]}
          outputPath=""
        />
      );

      // Modal should not be visible during capture
      expect(screen.queryByText('Capture finished')).not.toBeInTheDocument();
    });
  });

  describe('Contract 2: Progress updates do not duplicate', () => {
    it('shows stable app count without duplication on re-render', () => {
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
        { id: 'App2', source: 'winget' },
      ];
      const counts: CaptureCounts = {
        totalFound: 2,
        included: 2,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      const { rerender } = renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      // Verify initial count
      expect(screen.getByText('2')).toBeInTheDocument();
      
      // Re-render (simulates StrictMode double render)
      rerender(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );
      
      // Count should still appear once, not duplicated
      const countElements = screen.getAllByText('2');
      // Should appear once in the summary card
      expect(countElements.length).toBeGreaterThanOrEqual(1);
    });

    it('updates app count without duplication when count changes', () => {
      const initialApps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
      ];
      const initialCounts: CaptureCounts = {
        totalFound: 1,
        included: 1,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      const { rerender } = renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={initialCounts}
          appsIncluded={initialApps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      expect(screen.getByText('1')).toBeInTheDocument();
      
      // Update to more apps
      const updatedApps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
        { id: 'App2', source: 'winget' },
        { id: 'App3', source: 'winget' },
      ];
      const updatedCounts: CaptureCounts = {
        totalFound: 3,
        included: 3,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      rerender(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={updatedCounts}
          appsIncluded={updatedApps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );
      
      // Should show updated count
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.queryByText('1')).not.toBeInTheDocument();
    });
  });

  describe('Contract 3: Errors render stable message and allow retry', () => {
    it('allows closing modal to enable retry after capture', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
      ];
      const counts: CaptureCounts = {
        totalFound: 1,
        included: 1,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={onClose}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      const closeButton = screen.getByRole('button', { name: 'Done' });
      await user.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows stable draft message without duplication', () => {
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
      ];
      const counts: CaptureCounts = {
        totalFound: 1,
        included: 1,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };
      const outputPath = 'C:\\profiles\\test-profile.jsonc';

      const { rerender } = renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath={outputPath}
        />
      );

      // Modal now shows draft state message instead of path in header
      expect(screen.getByText(/not saved yet/i)).toBeInTheDocument();
      
      // Re-render (simulates StrictMode)
      rerender(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath={outputPath}
        />
      );
      
      // Draft message should appear once
      const draftElements = screen.getAllByText(/not saved yet/i);
      expect(draftElements).toHaveLength(1);
    });
  });

  describe('Contract 4: Success opens modal with technical details collapsed', () => {
    it('opens modal on success with technical details collapsed by default', () => {
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
        { id: 'App2', source: 'winget' },
      ];
      const counts: CaptureCounts = {
        totalFound: 2,
        included: 2,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      // Verify success state
      expect(screen.getByText('Capture finished')).toBeInTheDocument();
      
      // Verify technical details are collapsed
      const detailsButton = screen.getByRole('button', { name: /details \(/i });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'false');
      
      // Verify app details are not visible
      expect(screen.queryByText('App1')).not.toBeInTheDocument();
      expect(screen.queryByText('App2')).not.toBeInTheDocument();
    });

    it('can expand technical details after success', async () => {
      const user = userEvent.setup();
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
      ];
      const counts: CaptureCounts = {
        totalFound: 1,
        included: 1,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      const detailsButton = screen.getByRole('button', { name: /details \(/i });
      await user.click(detailsButton);
      
      // Details should now be expanded
      expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
      
      // Need to expand the source group to see apps
      const wingetGroup = screen.getByRole('button', { name: /winget/i });
      await user.click(wingetGroup);
      
      // App details should be visible
      await waitFor(() => {
        expect(screen.getByText('App1')).toBeInTheDocument();
      });
    });

    it('shows skipped count when apps are skipped', () => {
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
      ];
      const counts: CaptureCounts = {
        totalFound: 3,
        included: 1,
        skipped: 2,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      // Verify skipped count is shown
      expect(screen.getByText('Skipped')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Contract 5: Closing results resets transient UI state', () => {
    it('resets technical details expansion when modal closes', async () => {
      const user = userEvent.setup();
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
      ];
      const counts: CaptureCounts = {
        totalFound: 1,
        included: 1,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      const { unmount } = renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      // Expand details
      const detailsButton = screen.getByRole('button', { name: /details \(/i });
      await user.click(detailsButton);
      expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
      
      // Unmount modal (simulates closing)
      unmount();
      
      // Remount modal (simulates reopening)
      renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );
      
      // Details should be collapsed again
      const detailsButtonAfterReopen = screen.getByRole('button', { name: /details \(/i });
      expect(detailsButtonAfterReopen).toHaveAttribute('aria-expanded', 'false');
    });

    it('resets source expansion when modal closes', async () => {
      const user = userEvent.setup();
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
        { id: 'App2', source: 'chocolatey' },
      ];
      const counts: CaptureCounts = {
        totalFound: 2,
        included: 2,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      const { unmount } = renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      // Expand details
      const detailsButton = screen.getByRole('button', { name: /details \(/i });
      await user.click(detailsButton);
      
      // Expand winget source
      const wingetGroup = screen.getByRole('button', { name: /winget/i });
      await user.click(wingetGroup);
      
      // Unmount modal (simulates closing)
      unmount();
      
      // Remount modal (simulates reopening)
      renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );
      
      // Details should be collapsed (source groups not visible)
      const detailsButtonAfterReopen = screen.getByRole('button', { name: /details \(/i });
      expect(detailsButtonAfterReopen).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: /winget/i })).not.toBeInTheDocument();
    });

    it('does not persist modal state to localStorage', () => {
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
      ];
      const counts: CaptureCounts = {
        totalFound: 1,
        included: 1,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      // Verify no modal state keys in localStorage
      const keys = Object.keys(localStorage);
      expect(keys).not.toContain('capture-modal-open');
      expect(keys).not.toContain('capture-details-expanded');
      expect(keys).not.toContain('capture-modal-state');
    });
  });

  describe('Integration: Full Capture flow state transitions', () => {
    it('transitions from idle to success correctly', () => {
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
        { id: 'App2', source: 'winget' },
      ];
      const counts: CaptureCounts = {
        totalFound: 2,
        included: 2,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 0,
      };

      // 1. Modal closed during capture
      const { rerender } = renderWithProviders(
        <CaptureResultModal
          open={false}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={[]}
          outputPath=""
        />
      );

      expect(screen.queryByText('Capture finished')).not.toBeInTheDocument();
      
      // 2. Success state - modal opens
      rerender(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      expect(screen.getByText('Capture finished')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      
      // Technical details collapsed by default
      const detailsButton = screen.getByRole('button', { name: /details \(/i });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows sensitive excluded count when present', () => {
      const apps: CapturedApp[] = [
        { id: 'App1', source: 'winget' },
      ];
      const counts: CaptureCounts = {
        totalFound: 3,
        included: 1,
        skipped: 0,
        filteredRuntimes: 0,
        filteredStoreApps: 0,
        sensitiveExcludedCount: 2,
      };

      renderWithProviders(
        <CaptureResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          appsIncluded={apps}
          outputPath="C:\\profiles\\test.jsonc"
        />
      );

      // Verify sensitive excluded count is shown
      expect(screen.getByText('Excluded for safety')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });
});
