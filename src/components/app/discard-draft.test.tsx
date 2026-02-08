import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, fireEvent } from '../../test/test-utils';
import { OverviewScreen } from './overview-screen';
import { clearLocalStorage } from '../../test/localStorage-helpers';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { LifecycleState } from '@/lib/lifecycle-state';
import type { DiscoveredProfile } from '@/file-discovery';

// Mock useShowDetails to control Details visibility in tests
vi.mock('@/lib/use-show-details', () => ({
  useShowDetails: vi.fn(() => false),
}));

const defaultPerActionState = {
  actionStatusByAction: { capture: 'idle' as const, setup: 'idle' as const, check: 'idle' as const },
  actionProgressByAction: { capture: null, setup: null, check: null },
  actionResultByAction: { capture: null, setup: null, check: null },
};

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
    it('shows discard draft button when pendingCaptureDraft exists', async () => {
      const onDiscardDraft = vi.fn();
      const pendingDraft = {
        capturedAppsCount: 5,
        capturedAt: new Date().toISOString(),
        draftText: '{}',
        apps: ['app1', 'app2', 'app3', 'app4', 'app5'],
      };

      // runningAction="capture" auto-syncs activeFlow to 'capture'
      renderWithProviders(
        <OverviewScreen
          {...defaultPerActionState}
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
          pendingCaptureDraft={pendingDraft}
        />
      );

      // Verify discard draft button is present (auto-synced to capture flow)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /discard draft/i })).toBeInTheDocument();
      });
    });

    it('does not show discard draft button when no pending draft', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <OverviewScreen
          {...defaultPerActionState}
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
          pendingCaptureDraft={null}
        />
      );

      // Enter capture flow
      const captureCard = screen.getByTestId('flow-capture');
      await user.click(captureCard);

      // Verify discard draft button is NOT present
      expect(screen.queryByRole('button', { name: /discard draft/i })).not.toBeInTheDocument();
    });
  });

  describe('Contract 2: Clicking discard draft calls handler', () => {
    it('calls onDiscardDraft when discard draft button is clicked', async () => {
      const user = userEvent.setup();
      const onDiscardDraft = vi.fn();
      const pendingDraft = {
        capturedAppsCount: 5,
        capturedAt: new Date().toISOString(),
        draftText: '{}',
        apps: ['app1', 'app2', 'app3', 'app4', 'app5'],
      };

      // runningAction="capture" auto-syncs activeFlow to 'capture'
      renderWithProviders(
        <OverviewScreen
          {...defaultPerActionState}
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
          pendingCaptureDraft={pendingDraft}
        />
      );

      // Click discard draft button (auto-synced to capture flow)
      const discardButton = await screen.findByRole('button', { name: /discard draft/i });
      await user.click(discardButton);

      expect(onDiscardDraft).toHaveBeenCalledTimes(1);
    });
  });

  describe('Contract 3: Draft card shows amber warning state', () => {
    it('shows amber warning card for capture success with pending draft', async () => {
      const pendingDraft = {
        capturedAppsCount: 5,
        capturedAt: new Date().toISOString(),
        draftText: '{}',
        apps: ['app1', 'app2', 'app3', 'app4', 'app5'],
      };

      // runningAction="capture" auto-syncs activeFlow to 'capture'
      renderWithProviders(
        <OverviewScreen
          {...defaultPerActionState}
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
          pendingCaptureDraft={pendingDraft}
        />
      );

      // Verify amber warning state (auto-synced to capture flow)
      await waitFor(() => {
        expect(screen.getByText('Capture finished')).toBeInTheDocument();
        expect(screen.getByText(/not saved yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Contract 4: Capture success card persists after save', () => {
    it('shows capture success card after profile is saved (not after capture)', () => {
      renderWithProviders(
        <OverviewScreen
          {...defaultPerActionState}
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction={null}
          actionStatus="success"
          actionProgress={null}
          actionResult={{
            action: 'capture',
            status: 'success',
            summary: '63 apps captured',
            counts: { total: 63 },
          }}
          lastSavedProfileSummary={{
            appCount: 63,
            finishedAt: new Date().toISOString(),
            profileName: 'Test Profile',
          }}
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
          pendingCaptureDraft={null}
        />
      );

      // Enter capture flow to see the status strip
      const captureCard = screen.getByTestId('flow-capture');
      fireEvent.click(captureCard);

      // Verify capture success card shows "Completed successfully"
      expect(screen.getByText('Completed successfully')).toBeInTheDocument();
    });

    it('draft warning card shows when there is a pending draft (takes precedence over success)', () => {
      const pendingDraft = {
        capturedAppsCount: 63,
        capturedAt: new Date().toISOString(),
        draftText: '{}',
        apps: Array.from({ length: 63 }, (_, i) => `app${i + 1}`),
      };

      // initialExpandedCard="capture" auto-syncs activeFlow to 'capture'
      renderWithProviders(
        <OverviewScreen
          {...defaultPerActionState}
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction={null}
          actionStatus="success"
          actionProgress={null}
          actionResult={{
            action: 'capture',
            status: 'success',
            summary: '63 apps captured',
            counts: { total: 63 },
          }}
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
          pendingCaptureDraft={pendingDraft}
          initialExpandedCard="capture"
        />
      );

      // When there's a pending draft, draft warning takes precedence
      expect(screen.getByText('Capture finished')).toBeInTheDocument();
      expect(screen.getByText(/not saved yet/i)).toBeInTheDocument();

      // Success card should NOT be shown while draft exists
      expect(screen.queryByText('Completed successfully')).not.toBeInTheDocument();
    });

    it('saved profile success card persists across navigation', () => {
      const lastSavedProfileSummary = {
        appCount: 63,
        finishedAt: new Date().toISOString(),
        profileName: 'Test Profile',
      };

      const { rerender } = renderWithProviders(
        <OverviewScreen
          {...defaultPerActionState}
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction={null}
          actionStatus="success"
          actionProgress={null}
          actionResult={{
            action: 'capture',
            status: 'success',
            summary: '63 apps captured',
            counts: { total: 63 },
          }}
          lastSavedProfileSummary={lastSavedProfileSummary}
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
          pendingCaptureDraft={null}
        />
      );

      // Enter capture flow to see status strip
      const captureCard = screen.getByTestId('flow-capture');
      fireEvent.click(captureCard);

      // Verify capture success card is shown initially
      expect(screen.getByText('Completed successfully')).toBeInTheDocument();

      // Simulate navigation by re-rendering with initialExpandedCard to re-sync
      rerender(
        <OverviewScreen
          {...defaultPerActionState}
          lifecycleState={mockLifecycleState}
          selectedProfile="test-profile"
          profiles={mockProfiles}
          profilesDirectory="C:\\profiles"
          isRunning={false}
          runningAction={null}
          actionStatus="idle"
          actionProgress={null}
          actionResult={null}
          lastSavedProfileSummary={lastSavedProfileSummary}
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
          pendingCaptureDraft={null}
          initialExpandedCard="capture"
        />
      );

      // Verify saved profile success card still shows after re-render
      expect(screen.getByText('Completed successfully')).toBeInTheDocument();
    });
  });
});
