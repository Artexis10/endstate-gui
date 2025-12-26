import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../test/test-utils';
import { ApplyResultModal } from './apply-result-modal';
import { clearLocalStorage } from '../../test/localStorage-helpers';
import userEvent from '@testing-library/user-event';
import type { ApplyItem, ApplyCounts } from '../../types';
import '@testing-library/jest-dom/vitest';

/**
 * Apply Flow UX Contract Tests
 * 
 * These tests enforce the UX contracts for long-running Apply operations:
 * 1. When a run is active, primary actions are disabled and UI shows clear running state
 * 2. Progress/log updates do not duplicate (no double append on re-render / StrictMode)
 * 3. Errors render a stable, user-readable message and allow retry
 * 4. On success, results modal opens with technical details collapsed
 * 5. Closing results resets transient UI state
 */

describe('Apply Flow UX Contracts', () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  describe('Contract 1: Running state disables actions and shows clear UI', () => {
    it('shows applying state with disabled buttons and spinner', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'would_install' },
        { id: 'App2', driver: 'winget', status: 'ok', reason: 'already_installed' },
      ];
      const counts: ApplyCounts = {
        total: 2,
        installed: 0,
        alreadyInstalled: 1,
        skippedFiltered: 0,
        failed: 0,
      };

      renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          onApplyChanges={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={true}
          currentProgress={{ currentApp: 'App1', action: 'Installing' }}
        />
      );

      // Verify running state UI
      expect(screen.getByText('Applying changes...')).toBeInTheDocument();
      expect(screen.getByText(/Installing 1 app.*App1/)).toBeInTheDocument();
      
      // Verify spinner is visible
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      
      // Verify buttons are disabled
      const closeButton = screen.getByRole('button', { name: /Please wait/i });
      expect(closeButton).toBeDisabled();
    });

    it('prevents modal close during apply operation', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'would_install' },
      ];
      const counts: ApplyCounts = {
        total: 1,
        installed: 0,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 0,
      };

      renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={onClose}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={true}
        />
      );

      // Try to close - should be prevented
      const closeButton = screen.getByRole('button', { name: /Please wait/i });
      await user.click(closeButton);
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('disables Apply button during preview to prevent double-click', async () => {
      const user = userEvent.setup();
      const onApplyChanges = vi.fn();
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'would_install' },
      ];
      const counts: ApplyCounts = {
        total: 1,
        installed: 0,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 0,
      };

      renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          onApplyChanges={onApplyChanges}
          counts={counts}
          items={items}
          isDryRun={true}
          isApplying={false}
        />
      );

      const applyButton = screen.getByRole('button', { name: 'Apply changes' });
      
      // Click multiple times rapidly
      await user.click(applyButton);
      await user.click(applyButton);
      await user.click(applyButton);
      
      // Should only be called once due to idempotency guard
      expect(onApplyChanges).toHaveBeenCalledTimes(1);
    });
  });

  describe('Contract 2: Progress updates do not duplicate', () => {
    it('shows stable progress during apply without duplication', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'would_install' },
        { id: 'App2', driver: 'winget', status: 'ok', reason: 'would_install' },
      ];
      const counts: ApplyCounts = {
        total: 2,
        installed: 0,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 0,
      };

      const { rerender } = renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={true}
          currentProgress={{ currentApp: 'App1', action: 'Installing' }}
        />
      );

      // Verify initial progress
      expect(screen.getByText(/Installing 2 apps.*App1/)).toBeInTheDocument();
      
      // Re-render with same progress (simulates StrictMode double render)
      rerender(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={true}
          currentProgress={{ currentApp: 'App1', action: 'Installing' }}
        />
      );
      
      // Progress should still show once, not duplicated
      const progressElements = screen.getAllByText(/Installing 2 apps.*App1/);
      expect(progressElements).toHaveLength(1);
    });

    it('updates progress without duplication when app changes', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'would_install' },
        { id: 'App2', driver: 'winget', status: 'ok', reason: 'would_install' },
      ];
      const counts: ApplyCounts = {
        total: 2,
        installed: 0,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 0,
      };

      const { rerender } = renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={true}
          currentProgress={{ currentApp: 'App1', action: 'Installing' }}
        />
      );

      expect(screen.getByText(/App1/)).toBeInTheDocument();
      
      // Update to next app
      rerender(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={true}
          currentProgress={{ currentApp: 'App2', action: 'Installing' }}
        />
      );
      
      // Should show App2 now, not both
      expect(screen.getByText(/App2/)).toBeInTheDocument();
      expect(screen.queryByText(/App1/)).not.toBeInTheDocument();
    });
  });

  describe('Contract 3: Errors render stable message and allow retry', () => {
    it('shows error state with needs attention message', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'failed', reason: 'failed', message: 'Installation failed' },
        { id: 'App2', driver: 'winget', status: 'ok', reason: 'already_installed' },
      ];
      const counts: ApplyCounts = {
        total: 2,
        installed: 0,
        alreadyInstalled: 1,
        skippedFiltered: 0,
        failed: 1,
      };

      renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={false}
        />
      );

      // Verify error state UI
      expect(screen.getByText('Setup incomplete')).toBeInTheDocument();
      expect(screen.getByText(/1 needs attention/)).toBeInTheDocument();
      
      // Verify error icon
      const errorIcon = document.querySelector('.text-destructive');
      expect(errorIcon).toBeInTheDocument();
      
      // Verify close button is enabled (allows retry)
      const buttons = screen.getAllByRole('button', { name: /Close/i });
      const closeButton = buttons.find(btn => btn.textContent === 'Close');
      expect(closeButton).toBeDefined();
      expect(closeButton).toBeEnabled();
    });

    it('shows stable error message without duplication on re-render', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'failed', reason: 'failed', message: 'Network error' },
      ];
      const counts: ApplyCounts = {
        total: 1,
        installed: 0,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 1,
      };

      const { rerender } = renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={false}
        />
      );

      expect(screen.getByText('Setup incomplete')).toBeInTheDocument();
      
      // Re-render (simulates StrictMode)
      rerender(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={false}
        />
      );
      
      // Error message should appear once
      const errorTitles = screen.getAllByText('Setup incomplete');
      expect(errorTitles).toHaveLength(1);
    });

    it('allows closing modal after error to enable retry', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'failed', reason: 'failed' },
      ];
      const counts: ApplyCounts = {
        total: 1,
        installed: 0,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 1,
      };

      renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={onClose}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={false}
        />
      );

      const buttons = screen.getAllByRole('button', { name: /Close/i });
      const closeButton = buttons.find(btn => btn.textContent === 'Close');
      expect(closeButton).toBeDefined();
      await user.click(closeButton!);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Contract 4: Success opens modal with technical details collapsed', () => {
    it('opens modal on success with technical details collapsed by default', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
        { id: 'App2', driver: 'winget', status: 'ok', reason: 'already_installed' },
      ];
      const counts: ApplyCounts = {
        total: 2,
        installed: 1,
        alreadyInstalled: 1,
        skippedFiltered: 0,
        failed: 0,
      };

      renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={false}
        />
      );

      // Verify success state
      expect(screen.getByText('Your computer is ready')).toBeInTheDocument();
      
      // Verify technical details are collapsed
      const detailsButton = screen.getByRole('button', { name: /Toggle technical details/i });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'false');
      
      // Verify details content is not visible
      expect(screen.queryByText('App1')).not.toBeInTheDocument();
    });

    it('shows preview modal with technical details collapsed by default', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'would_install' },
      ];
      const counts: ApplyCounts = {
        total: 1,
        installed: 0,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 0,
      };

      renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          onApplyChanges={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={true}
          isApplying={false}
        />
      );

      // Verify preview state
      expect(screen.getByText("Here's what will change")).toBeInTheDocument();
      
      // Verify technical details are collapsed
      const detailsButton = screen.getByRole('button', { name: /Toggle technical details/i });
      expect(detailsButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('can expand technical details after success', async () => {
      const user = userEvent.setup();
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
      ];
      const counts: ApplyCounts = {
        total: 1,
        installed: 1,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 0,
      };

      renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={false}
        />
      );

      const detailsButton = screen.getByRole('button', { name: /Toggle technical details/i });
      await user.click(detailsButton);
      
      // Details should now be expanded
      expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
      
      // App details should be visible
      await waitFor(() => {
        expect(screen.getByText('App1')).toBeInTheDocument();
      });
    });
  });

  describe('Contract 5: Closing results resets transient UI state', () => {
    it('resets technical details expansion when modal closes', async () => {
      const user = userEvent.setup();
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
      ];
      const counts: ApplyCounts = {
        total: 1,
        installed: 1,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 0,
      };

      const { unmount } = renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={false}
        />
      );

      // Expand details
      const detailsButton = screen.getByRole('button', { name: /Toggle technical details/i });
      await user.click(detailsButton);
      expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
      
      // Unmount modal (simulates closing)
      unmount();
      
      // Remount modal (simulates reopening)
      renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={false}
        />
      );
      
      // Details should be collapsed again
      const detailsButtonAfterReopen = screen.getByRole('button', { name: /Toggle technical details/i });
      expect(detailsButtonAfterReopen).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not persist modal state to localStorage', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
      ];
      const counts: ApplyCounts = {
        total: 1,
        installed: 1,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 0,
      };

      renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={false}
        />
      );

      // Verify no modal state keys in localStorage
      const keys = Object.keys(localStorage);
      expect(keys).not.toContain('apply-modal-open');
      expect(keys).not.toContain('apply-details-expanded');
      expect(keys).not.toContain('apply-modal-state');
    });
  });

  describe('Integration: Full Apply flow state transitions', () => {
    it('transitions from preview to applying to success correctly', () => {
      const items: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'would_install' },
      ];
      const counts: ApplyCounts = {
        total: 1,
        installed: 0,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 0,
      };

      // 1. Preview state
      const { rerender } = renderWithProviders(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          onApplyChanges={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={true}
          isApplying={false}
        />
      );

      expect(screen.getByText("Here's what will change")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Apply changes' })).toBeEnabled();
      
      // 2. Applying state
      rerender(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={counts}
          items={items}
          isDryRun={false}
          isApplying={true}
          currentProgress={{ currentApp: 'App1', action: 'Installing' }}
        />
      );

      expect(screen.getByText('Applying changes...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Please wait/i })).toBeDisabled();
      
      // 3. Success state
      const successItems: ApplyItem[] = [
        { id: 'App1', driver: 'winget', status: 'ok', reason: 'installed' },
      ];
      const successCounts: ApplyCounts = {
        total: 1,
        installed: 1,
        alreadyInstalled: 0,
        skippedFiltered: 0,
        failed: 0,
      };

      rerender(
        <ApplyResultModal
          open={true}
          onClose={vi.fn()}
          counts={successCounts}
          items={successItems}
          isDryRun={false}
          isApplying={false}
        />
      );

      expect(screen.getByText('Your computer is ready')).toBeInTheDocument();
      // Find the main Close button (not the X button's sr-only Close)
      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      const mainCloseButton = closeButtons.find(btn => btn.classList.contains('w-full'));
      expect(mainCloseButton).toBeEnabled();
    });
  });
});
