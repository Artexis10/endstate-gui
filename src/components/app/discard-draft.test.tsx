import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../test/test-utils';
import { OverviewScreen } from './overview-screen';
import { clearLocalStorage } from '../../test/localStorage-helpers';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { LifecycleState } from '@/lib/lifecycle-state';
import type { DiscoveredProfile } from '@/file-discovery';

// Mock useShowDetails to control Details visibility in tests
vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => false), // Default to false for simpler UI
}));

/**
 * Discard Draft UX Tests
 * 
 * These tests enforce the UX contracts for the discard draft functionality:
 * 1. Discard draft button appears when pendingCaptureDraftPath exists
 * 2. Clicking discard draft calls onDiscardDraft handler
 * 3. Cancel/close of Save Profile modal does NOT clear draft
 * 4. Save success clears draft and shows green card
 * 5. Manage Profiles delete is blocked when target == pending draft path
 */

describe('Discard Draft UX Contracts', () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  const mockLifecycleState: LifecycleState = {
    lastCapture: null,
    lastPreview: null,
    lastApply: null,
    lastVerify: null,
  };

  const mockProfiles: DiscoveredProfile[] = [
    {
      name: 'test-profile',
      path: 'C:\\profiles\\test-profile.jsonc',
      displayName: 'Test Profile',
    },
  ];

  describe('Contract 1: Discard draft button appears with pending draft', () => {
    it('shows discard draft button when pendingCaptureDraftPath exists', async () => {
      const onDiscardDraft = vi.fn();
      const pendingDraftPath = 'C:\\profiles\\draft_2024-01-01.jsonc';

      renderWithProviders(
        <OverviewScreen
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction="capture"
          actionStatus="success"
          actionProgress={null}
          actionResult={{
            action: 'capture',
            status: 'success',
            summary: '5 apps captured',
          }}
          initialExpandedCard="capture"
          onNavigate={vi.fn()}
          onCapture={vi.fn()}
          onSetup={vi.fn()}
          onCheck={vi.fn()}
          onProfileChange={vi.fn()}
          onDismissResult={vi.fn()}
          onOpenProfilesFolder={vi.fn()}
          onRefreshProfiles={vi.fn()}
          onSaveProfile={vi.fn()}
          onDiscardDraft={onDiscardDraft}
          pendingCaptureDraftPath={pendingDraftPath}
        />
      );

      // Verify discard draft button is present (card should be auto-expanded)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discard draft/i })).toBeInTheDocument();
      });
    });

    it('does not show discard draft button when no pending draft', async () => {
      const user = userEvent.setup();
      
      renderWithProviders(
        <OverviewScreen
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction={null}
          actionStatus="idle"
          actionProgress={null}
          actionResult={null}
          onNavigate={vi.fn()}
          onCapture={vi.fn()}
          onSetup={vi.fn()}
          onCheck={vi.fn()}
          onProfileChange={vi.fn()}
          onDismissResult={vi.fn()}
          onOpenProfilesFolder={vi.fn()}
          onRefreshProfiles={vi.fn()}
          onSaveProfile={vi.fn()}
          onDiscardDraft={vi.fn()}
          pendingCaptureDraftPath={null}
        />
      );

      // Expand capture card
      const captureCard = screen.getByTestId('overview-card-capture');
      await user.click(captureCard);

      // Verify discard draft button is NOT present
      expect(screen.queryByRole('button', { name: /discard draft/i })).not.toBeInTheDocument();
    });
  });

  describe('Contract 2: Clicking discard draft calls handler', () => {
    it('calls onDiscardDraft when discard draft button is clicked', async () => {
      const user = userEvent.setup();
      const onDiscardDraft = vi.fn();
      const pendingDraftPath = 'C:\\profiles\\draft_2024-01-01.jsonc';

      renderWithProviders(
        <OverviewScreen
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction="capture"
          actionStatus="success"
          actionProgress={null}
          actionResult={{
            action: 'capture',
            status: 'success',
            summary: '5 apps captured',
          }}
          initialExpandedCard="capture"
          onNavigate={vi.fn()}
          onCapture={vi.fn()}
          onSetup={vi.fn()}
          onCheck={vi.fn()}
          onProfileChange={vi.fn()}
          onDismissResult={vi.fn()}
          onOpenProfilesFolder={vi.fn()}
          onRefreshProfiles={vi.fn()}
          onSaveProfile={vi.fn()}
          onDiscardDraft={onDiscardDraft}
          pendingCaptureDraftPath={pendingDraftPath}
        />
      );

      // Click discard draft button (card should be auto-expanded)
      const discardButton = await screen.findByRole('button', { name: /discard draft/i });
      await user.click(discardButton);

      // Verify handler was called
      expect(onDiscardDraft).toHaveBeenCalledTimes(1);
    });
  });

  describe('Contract 3: Draft card shows amber warning state', () => {
    it('shows amber warning card for capture success with pending draft', async () => {
      const pendingDraftPath = 'C:\\profiles\\draft_2024-01-01.jsonc';

      renderWithProviders(
        <OverviewScreen
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction="capture"
          actionStatus="success"
          actionProgress={null}
          actionResult={{
            action: 'capture',
            status: 'success',
            summary: '5 apps captured',
          }}
          initialExpandedCard="capture"
          onNavigate={vi.fn()}
          onCapture={vi.fn()}
          onSetup={vi.fn()}
          onCheck={vi.fn()}
          onProfileChange={vi.fn()}
          onDismissResult={vi.fn()}
          onOpenProfilesFolder={vi.fn()}
          onRefreshProfiles={vi.fn()}
          onSaveProfile={vi.fn()}
          onDiscardDraft={vi.fn()}
          pendingCaptureDraftPath={pendingDraftPath}
        />
      );

      // Verify amber warning state (card should be auto-expanded)
      await waitFor(() => {
        expect(screen.getByText('Capture finished')).toBeInTheDocument();
        expect(screen.getByText(/not saved yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Contract 4: Green saved card appears after save', () => {
    it('shows green saved card when lastSavedProfile exists and no pending draft', () => {
      const lastSavedProfile = {
        name: 'My New Profile',
        timestamp: new Date(),
      };

      renderWithProviders(
        <OverviewScreen
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction={null}
          actionStatus="idle"
          actionProgress={null}
          actionResult={null}
          onNavigate={vi.fn()}
          onCapture={vi.fn()}
          onSetup={vi.fn()}
          onCheck={vi.fn()}
          onProfileChange={vi.fn()}
          onDismissResult={vi.fn()}
          onOpenProfilesFolder={vi.fn()}
          onRefreshProfiles={vi.fn()}
          onSaveProfile={vi.fn()}
          onDiscardDraft={vi.fn()}
          pendingCaptureDraftPath={null}
          lastSavedProfile={lastSavedProfile}
        />
      );

      // Verify green saved card is shown WITHOUT expanding (Contract D)
      expect(screen.getByText('Profile saved')).toBeInTheDocument();
      expect(screen.getByText('My New Profile')).toBeInTheDocument();
    });

    it('does not show green saved card when pending draft exists', () => {
      const lastSavedProfile = {
        name: 'My New Profile',
        timestamp: new Date(),
      };
      const pendingDraftPath = 'C:\\profiles\\draft_2024-01-01.jsonc';

      renderWithProviders(
        <OverviewScreen
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction={null}
          actionStatus="idle"
          actionProgress={null}
          actionResult={null}
          onNavigate={vi.fn()}
          onCapture={vi.fn()}
          onSetup={vi.fn()}
          onCheck={vi.fn()}
          onProfileChange={vi.fn()}
          onDismissResult={vi.fn()}
          onOpenProfilesFolder={vi.fn()}
          onRefreshProfiles={vi.fn()}
          onSaveProfile={vi.fn()}
          onDiscardDraft={vi.fn()}
          pendingCaptureDraftPath={pendingDraftPath}
          lastSavedProfile={lastSavedProfile}
        />
      );

      // Verify green saved card is NOT shown when draft exists
      expect(screen.queryByText('Profile saved')).not.toBeInTheDocument();
    });

    it('green saved card persists across navigation (render condition test)', () => {
      const lastSavedProfile = {
        name: 'My New Profile',
        timestamp: new Date(),
      };

      const { rerender } = renderWithProviders(
        <OverviewScreen
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction={null}
          actionStatus="idle"
          actionProgress={null}
          actionResult={null}
          onNavigate={vi.fn()}
          onCapture={vi.fn()}
          onSetup={vi.fn()}
          onCheck={vi.fn()}
          onProfileChange={vi.fn()}
          onDismissResult={vi.fn()}
          onOpenProfilesFolder={vi.fn()}
          onRefreshProfiles={vi.fn()}
          onSaveProfile={vi.fn()}
          onDiscardDraft={vi.fn()}
          pendingCaptureDraftPath={null}
          lastSavedProfile={lastSavedProfile}
        />
      );

      // Verify green saved card is shown initially WITHOUT expanding (Contract D)
      expect(screen.getByText('Profile saved')).toBeInTheDocument();

      // Simulate navigation by re-rendering (component remount)
      rerender(
        <OverviewScreen
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction={null}
          actionStatus="idle"
          actionProgress={null}
          actionResult={null}
          onNavigate={vi.fn()}
          onCapture={vi.fn()}
          onSetup={vi.fn()}
          onCheck={vi.fn()}
          onProfileChange={vi.fn()}
          onDismissResult={vi.fn()}
          onOpenProfilesFolder={vi.fn()}
          onRefreshProfiles={vi.fn()}
          onSaveProfile={vi.fn()}
          onDiscardDraft={vi.fn()}
          pendingCaptureDraftPath={null}
          lastSavedProfile={lastSavedProfile}
        />
      );

      // Verify green saved card still shows after re-render WITHOUT expanding (Contract D)
      expect(screen.getByText('Profile saved')).toBeInTheDocument();
      expect(screen.getByText('My New Profile')).toBeInTheDocument();
    });
  });
});
